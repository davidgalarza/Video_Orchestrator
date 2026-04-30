from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
import uuid
import os
import time
import logging
from contextlib import asynccontextmanager
from google import genai
from google.genai import types
from dotenv import load_dotenv

import models, schemas, database

# Load environment variables
load_dotenv()

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Google GenAI Client
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

BASE_URL = "http://localhost:8000"

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with database.engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    yield

app = FastAPI(title="Veo Simplified", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve local media files
app.mount("/data", StaticFiles(directory="data"), name="data")

import asyncio

async def run_video_generation(project_id: str, scene_id: str, db_session_factory):
    async with db_session_factory() as db:
        # Fetch Scene with its project and project's assets
        result = await db.execute(
            select(models.Scene)
            .where(models.Scene.id == scene_id)
            .options(
                selectinload(models.Scene.project).selectinload(models.Project.assets)
            )
        )
        scene = result.scalar_one_or_none()
        if not scene: return

        scene.status = "processing"
        await db.commit()
        await db.refresh(scene)

        try:
            # Prepare reference images
            genai_refs = []
            
            # 1. Add Project Assets (Characters/Styles)
            for asset in scene.project.assets:
                # Veo needs a URI. We upload to Google's File API temporarily.
                local_asset_path = asset.file_path.lstrip("/") # Remove leading / for os.path
                full_asset_path = os.path.join(os.getcwd(), local_asset_path)
                
                if os.path.exists(full_asset_path):
                    logger.info(f"Using asset: {asset.id}")
                    with open(full_asset_path, "rb") as f:
                        asset_bytes = f.read()
                    
                    # Determine mime type
                    mime_type = "image/png" if full_asset_path.endswith(".png") else "image/jpeg"
                    
                    ref_type = "ASSET" if asset.type in ["CHARACTER", "PRODUCT"] else "STYLE"
                    genai_refs.append(types.VideoGenerationReferenceImage(
                        image=types.Image(image_bytes=asset_bytes, mime_type=mime_type),
                        reference_type=ref_type
                    ))

            # 2. Add Continuity (Previous Scene)
            first_frame_image = None
            if scene.order > 1:
                prev_result = await db.execute(
                    select(models.Scene).where(
                        models.Scene.project_id == project_id, 
                        models.Scene.order == scene.order - 1
                    )
                )
                prev_scene = prev_result.scalar_one_or_none()
                if prev_scene and prev_scene.video_path:
                    local_v_path = prev_scene.video_path.lstrip("/")
                    full_v_path = os.path.join(os.getcwd(), local_v_path)
                    if os.path.exists(full_v_path):
                        logger.info(f"Using previous scene for continuity: {prev_scene.id}")
                        with open(full_v_path, "rb") as f:
                            v_bytes = f.read()
                        # Use video/mp4 for continuity reference
                        first_frame_image = types.Image(image_bytes=v_bytes, mime_type="video/mp4")

            # Generate video
            config = types.GenerateVideosConfig(
                aspect_ratio="16:9",
                reference_images=genai_refs if genai_refs else None
            )
            
            operation = await asyncio.to_thread(
                client.models.generate_videos,
                model="veo-3.1-generate-preview",
                prompt=scene.prompt,
                image=first_frame_image,
                config=config
            )

            # Poll for completion
            while not operation.done:
                logger.info(f"Waiting for video generation (Scene {scene_id})...")
                await asyncio.sleep(10) # Non-blocking sleep
                operation = await asyncio.to_thread(client.operations.get, operation)

            # Download and save (running blocking IO in a thread)
            def save_video():
                generated_video = operation.response.generated_videos[0]
                video_filename = f"{scene_id}.mp4"
                video_path = os.path.join("data", "videos", video_filename)
                
                client.files.download(file=generated_video.video)
                generated_video.video.save(video_path)
                return f"/data/videos/{video_filename}"

            video_url = await asyncio.to_thread(save_video)
            
            # Re-fetch scene to ensure session is fresh for final update
            result = await db.execute(select(models.Scene).where(models.Scene.id == scene_id))
            scene = result.scalar_one()
            
            scene.video_path = video_url
            scene.status = "completed"
            logger.info(f"Video saved successfully for scene {scene_id}")
            
        except Exception as e:
            logger.error(f"Generation failed for scene {scene_id}: {e}")
            # Re-fetch for error update
            result = await db.execute(select(models.Scene).where(models.Scene.id == scene_id))
            scene = result.scalar_one_or_none()
            if scene:
                scene.status = "failed"
        
        await db.commit()

@app.post("/projects", response_model=schemas.Project)
async def create_project(project: schemas.ProjectCreate, db: AsyncSession = Depends(database.get_db)):
    db_project = models.Project(name=project.name)
    db.add(db_project)
    await db.commit()
    
    # Reload with selectinload to avoid lazy loading errors during serialization
    result = await db.execute(
        select(models.Project)
        .where(models.Project.id == db_project.id)
        .options(selectinload(models.Project.assets), selectinload(models.Project.scenes))
    )
    db_project = result.scalar_one()
    
    # Pre-populate URLs (they will be empty/None for a new project)
    db_project.assets = []
    db_project.scenes = []
    
    return db_project

@app.get("/projects", response_model=List[schemas.Project])
async def get_projects(db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Project).options(selectinload(models.Project.assets), selectinload(models.Project.scenes)))
    projects = result.scalars().all()
    for p in projects:
        for a in p.assets: a.public_url = f"{BASE_URL}{a.file_path}"
        for s in p.scenes: s.public_url = f"{BASE_URL}{s.video_path}" if s.video_path else None
    return projects

@app.delete("/projects/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Project).where(models.Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    
    await db.delete(project)
    await db.commit()
    return {"message": "Project deleted"}

@app.get("/projects/{project_id}", response_model=schemas.Project)
async def get_project(project_id: str, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(
        select(models.Project).where(models.Project.id == project_id).options(
            selectinload(models.Project.assets), selectinload(models.Project.scenes)
        )
    )
    p = result.scalar_one_or_none()
    if not p: raise HTTPException(status_code=404, detail="Project not found")
    for a in p.assets: a.public_url = f"{BASE_URL}{a.file_path}"
    for s in p.scenes: s.public_url = f"{BASE_URL}{s.video_path}" if s.video_path else None
    return p

@app.post("/projects/{project_id}/assets", response_model=schemas.Asset)
async def upload_asset(project_id: str, type: str = Form(...), file: UploadFile = File(...), db: AsyncSession = Depends(database.get_db)):
    file_ext = file.filename.split(".")[-1]
    asset_id = str(uuid.uuid4())
    filename = f"{asset_id}.{file_ext}"
    file_path = os.path.join("data", "assets", filename)
    
    with open(file_path, "wb") as f:
        f.write(await file.read())
        
    db_asset = models.Asset(project_id=project_id, type=type, file_path=f"/data/assets/{filename}")
    db.add(db_asset)
    await db.commit()
    await db.refresh(db_asset)
    return db_asset

@app.post("/projects/{project_id}/scenes", response_model=schemas.Scene)
async def create_scene(project_id: str, scene: schemas.SceneBase, db: AsyncSession = Depends(database.get_db)):
    db_scene = models.Scene(project_id=project_id, order=scene.order, prompt=scene.prompt)
    db.add(db_scene)
    await db.commit()
    await db.refresh(db_scene)
    return db_scene

@app.post("/projects/{project_id}/scenes/{scene_id}/generate")
async def trigger_generation(project_id: str, scene_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_video_generation, project_id, scene_id, database.SessionLocal)
    return {"message": "Generation started"}

@app.get("/projects/{project_id}/scenes/{scene_id}/status", response_model=schemas.Scene)
async def get_scene_status(project_id: str, scene_id: str, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Scene).where(models.Scene.id == scene_id))
    scene = result.scalar_one_or_none()
    if not scene: raise HTTPException(status_code=404, detail="Scene not found")
    scene.public_url = f"{BASE_URL}{scene.video_path}" if scene.video_path else None
    return scene

@app.post("/projects/{project_id}/export")
async def export_project(project_id: str, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(
        select(models.Project).where(models.Project.id == project_id).options(selectinload(models.Project.scenes))
    )
    project = result.scalar_one_or_none()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    
    completed_scenes = sorted([s for s in project.scenes if s.status == "completed"], key=lambda x: x.order)
    if not completed_scenes:
        raise HTTPException(status_code=400, detail="No completed scenes to export")
    
    # Create FFmpeg concat file
    concat_content = ""
    for s in completed_scenes:
        # Get absolute path for ffmpeg
        rel_path = s.video_path.lstrip("/")
        abs_path = os.path.abspath(rel_path)
        concat_content += f"file '{abs_path}'\n"
    
    concat_file_path = os.path.join("data", "exports", f"{project_id}_list.txt")
    with open(concat_file_path, "w") as f:
        f.write(concat_content)
    
    output_filename = f"{project_id}_master.mp4"
    output_path = os.path.join("data", "exports", output_filename)
    
    # Run FFmpeg (simplest version)
    # -f concat -safe 0 -i list.txt -c copy output.mp4
    import subprocess
    cmd = [
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", 
        "-i", concat_file_path, "-c", "copy", output_path
    ]
    
    try:
        subprocess.run(cmd, check=True)
        return {"export_url": f"{BASE_URL}/data/exports/{output_filename}"}
    except Exception as e:
        logger.error(f"FFmpeg failed: {e}")
        raise HTTPException(status_code=500, detail="Stitching failed. Is FFmpeg installed?")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
