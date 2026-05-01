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
import asyncio

import models, schemas, database

# Load environment variables
load_dotenv()

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Google GenAI Client
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

BASE_URL = "http://192.168.29.47:8000"

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with database.engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    
    # Initialize Global Settings
    async with database.SessionLocal() as db:
        result = await db.execute(select(models.GlobalSettings))
        settings = result.scalar_one_or_none()
        if not settings:
            db.add(models.GlobalSettings())
            await db.commit()
    yield

app = FastAPI(title="Vid_Gen Studio", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve local media files
app.mount("/data", StaticFiles(directory="data"), name="data")

# Directories
ASSETS_DIR = "data/assets"
VIDEOS_DIR = "data/videos"

# Create data directories
os.makedirs(ASSETS_DIR, exist_ok=True)
os.makedirs(VIDEOS_DIR, exist_ok=True)
os.makedirs("data/exports", exist_ok=True)

async def run_video_generation(project_id: str, scene_id: str, db_session_factory):
    async with db_session_factory() as db:
        # Fetch Scene with its project, project's assets and first_frame_asset
        result = await db.execute(
            select(models.Scene)
            .where(models.Scene.id == scene_id)
            .options(
                selectinload(models.Scene.project).selectinload(models.Project.assets),
                selectinload(models.Scene.first_frame_asset),
                selectinload(models.Scene.last_frame_asset)
            )
        )
        scene = result.scalar_one_or_none()
        if not scene: return

        # Fetch Global Settings
        settings_result = await db.execute(select(models.GlobalSettings))
        settings = settings_result.scalar_one()

        scene.status = "processing"
        await db.commit()
        await db.refresh(scene)

        try:
            # Handle Start Frame (with fallback to linked assets)
            first_frame_image = None
            anchor_asset = scene.first_frame_asset
            if not anchor_asset and scene.project.assets:
                anchor_asset = scene.project.assets[0]

            if anchor_asset:
                local_path = anchor_asset.file_path.lstrip("/")
                full_path = os.path.join(os.getcwd(), local_path)
                if os.path.exists(full_path):
                    with open(full_path, "rb") as f:
                        start_bytes = f.read()
                    mime_type = "image/png" if full_path.endswith(".png") else "image/jpeg"
                    first_frame_image = types.Image(image_bytes=start_bytes, mime_type=mime_type)

            # Handle End Frame Guidance
            target_guidance = ""
            if scene.last_frame_asset:
                target_guidance = " smoothly transitioning to match the composition and visual target of the end reference"

            # Merge Global Styling and End Frame Guidance
            full_prompt = f"{settings.global_prompt_prefix} {scene.prompt}{target_guidance} {settings.global_prompt_suffix}".strip()

            # Generate video
            config = types.GenerateVideosConfig(
                aspect_ratio=settings.aspect_ratio
            )
            
            operation = await asyncio.to_thread(
                client.models.generate_videos,
                model=settings.model_id,
                prompt=full_prompt,
                image=first_frame_image,
                config=config
            )

            while not operation.done:
                await asyncio.sleep(10)
                operation = await asyncio.to_thread(client.operations.get, operation)

            def save_video():
                generated_video = operation.response.generated_videos[0]
                video_filename = f"{scene_id}.mp4"
                video_path = os.path.join("data", "videos", video_filename)
                client.files.download(file=generated_video.video)
                generated_video.video.save(video_path)
                return f"/data/videos/{video_filename}"

            video_url = await asyncio.to_thread(save_video)
            
            # Refresh scene for final update
            result = await db.execute(select(models.Scene).where(models.Scene.id == scene_id))
            scene = result.scalar_one()
            scene.video_path = video_url
            scene.status = "completed"
            await db.commit()

            # Log Usage
            try:
                await log_usage("VIDEO", settings.model_id, 5000, 0.10, db_session_factory)
            except Exception as e:
                logger.error(f"Failed to log video usage: {e}")
            
        except Exception as e:
            logger.error(f"Generation failed for scene {scene_id}: {e}")
            result = await db.execute(select(models.Scene).where(models.Scene.id == scene_id))
            scene = result.scalar_one_or_none()
            if scene: scene.status = "failed"
        
        await db.commit()

# --- Endpoints ---

@app.get("/settings", response_model=schemas.GlobalSettings)
async def get_settings(db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.GlobalSettings))
    return result.scalar_one()

@app.patch("/settings", response_model=schemas.GlobalSettings)
async def update_settings(settings: schemas.GlobalSettingsUpdate, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.GlobalSettings))
    db_settings = result.scalar_one()
    for key, value in settings.model_dump(exclude_unset=True).items():
        setattr(db_settings, key, value)
    await db.commit()
    await db.refresh(db_settings)
    return db_settings

@app.get("/projects", response_model=List[schemas.Project])
async def get_projects(db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Project).options(selectinload(models.Project.assets), selectinload(models.Project.scenes)))
    projects = result.scalars().all()
    for p in projects:
        for a in p.assets: a.public_url = f"{BASE_URL}{a.file_path}"
        for s in p.scenes: s.public_url = f"{BASE_URL}{s.video_path}" if s.video_path else None
    return projects

@app.post("/projects", response_model=schemas.Project)
async def create_project(project: schemas.ProjectCreate, db: AsyncSession = Depends(database.get_db)):
    db_project = models.Project(name=project.name)
    db.add(db_project)
    await db.commit()
    await db.refresh(db_project)
    
    # Reload with selectinload
    result = await db.execute(
        select(models.Project).where(models.Project.id == db_project.id)
        .options(selectinload(models.Project.assets), selectinload(models.Project.scenes))
    )
    return result.scalar_one()

@app.delete("/projects/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Project).where(models.Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    await db.delete(project)
    await db.commit()
    return {"message": "Deleted"}

@app.get("/projects/{project_id}", response_model=schemas.Project)
async def get_project(project_id: str, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(
        select(models.Project).where(models.Project.id == project_id).options(
            selectinload(models.Project.assets), 
            selectinload(models.Project.scenes).options(
                selectinload(models.Scene.first_frame_asset),
                selectinload(models.Scene.last_frame_asset)
            )
        )
    )
    p = result.scalar_one_or_none()
    if not p: raise HTTPException(status_code=404, detail="Project not found")
    for a in p.assets: a.public_url = f"{BASE_URL}{a.file_path}"
    for s in p.scenes: 
        s.public_url = f"{BASE_URL}{s.video_path}" if s.video_path else None
        if s.first_frame_asset: s.first_frame_asset.public_url = f"{BASE_URL}{s.first_frame_asset.file_path}"
        if s.last_frame_asset: s.last_frame_asset.public_url = f"{BASE_URL}{s.last_frame_asset.file_path}"
    return p

@app.get("/assets/global", response_model=List[schemas.Asset])
async def get_global_assets(db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Asset).where(models.Asset.is_global == 1))
    assets = result.scalars().all()
    for a in assets: a.public_url = f"{BASE_URL}{a.file_path}"
    return assets

@app.post("/assets/generate", response_model=schemas.ImageGenerationResponse)
async def generate_assets(req: schemas.ImageGenerationRequest, db: AsyncSession = Depends(database.get_db)):
    try:
        # Get global settings for aspect ratio
        res = await db.execute(select(models.GlobalSettings).where(models.GlobalSettings.id == 1))
        settings = res.scalar_one_or_none()
        layout_hint = f" Aspect ratio: {settings.aspect_ratio}." if settings else ""
        
        new_assets = []
        response = await asyncio.to_thread(
            client.models.generate_content,
            model='gemini-3.1-flash-image-preview',
            contents=[f"{req.prompt}{layout_hint}"]
        )
        
        for part in response.parts:
            if part.inline_data:
                    asset_id = str(uuid.uuid4())
                    filename = f"gen_{asset_id}.png"
                    filepath = os.path.join(ASSETS_DIR, filename)
                    
                    # Use the part.as_image() utility or save bytes
                    img = part.as_image()
                    img.save(filepath)
                    
                    db_asset = models.Asset(
                        id=asset_id,
                        type="STYLE", 
                        file_path=f"/data/assets/{filename}",
                        is_global=True
                    )
                    db.add(db_asset)
                    new_assets.append(db_asset)
            
        await db.commit()
        
        # Log Usage
        try:
            tokens = response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') else 1000
            await log_usage("IMAGE", "gemini-3.1-flash-image-preview", tokens, 0.01, database.SessionLocal)
        except: pass

        for a in new_assets:
            a.public_url = f"{BASE_URL}{a.file_path}"
        return {"assets": new_assets}
    except Exception as e:
        logger.error(f"Gemini image generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def log_usage(type: str, model_id: str, tokens: int, cost: float, db_factory):
    async with db_factory() as db:
        log = models.UsageLog(
            type=type,
            model_id=model_id,
            total_tokens=tokens,
            estimated_cost=cost
        )
        db.add(log)
        await db.commit()

@app.get("/usage/summary", response_model=schemas.UsageSummary)
async def get_usage_summary(db: AsyncSession = Depends(database.get_db)):
    from sqlalchemy import func
    res = await db.execute(select(
        func.sum(models.UsageLog.total_tokens),
        func.sum(models.UsageLog.estimated_cost),
        func.count(models.UsageLog.id).filter(models.UsageLog.type == 'IMAGE'),
        func.count(models.UsageLog.id).filter(models.UsageLog.type == 'VIDEO')
    ))
    row = res.one()
    return {
        "total_tokens": row[0] or 0,
        "total_cost": row[1] or 0.0,
        "image_count": row[2] or 0,
        "video_count": row[3] or 0
    }

@app.post("/assets/global", response_model=schemas.Asset)
async def upload_global_asset(type: str = Form(...), file: UploadFile = File(...), db: AsyncSession = Depends(database.get_db)):
    asset_id = str(uuid.uuid4())
    ext = os.path.splitext(file.filename)[1]
    file_path = f"/data/assets/{asset_id}{ext}"
    with open(file_path.lstrip("/"), "wb") as f:
        f.write(await file.read())
    
    db_asset = models.Asset(id=asset_id, type=type, file_path=file_path, is_global=True)
    db.add(db_asset)
    await db.commit()
    await db.refresh(db_asset)
    db_asset.public_url = f"{BASE_URL}{db_asset.file_path}"
    return db_asset

@app.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Asset).where(models.Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset: raise HTTPException(status_code=404, detail="Asset not found")
    
    # Remove file from disk
    try:
        path = asset.file_path.lstrip("/")
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        logger.error(f"Failed to delete file: {e}")
    
    await db.delete(asset)
    await db.commit()
    return {"message": "Destroyed"}

@app.post("/projects/{project_id}/assets/link/{asset_id}")
async def link_asset_to_project(project_id: str, asset_id: str, db: AsyncSession = Depends(database.get_db)):
    p_res = await db.execute(select(models.Project).where(models.Project.id == project_id).options(selectinload(models.Project.assets)))
    project = p_res.scalar_one_or_none()
    a_res = await db.execute(select(models.Asset).where(models.Asset.id == asset_id))
    asset = a_res.scalar_one_or_none()
    
    if not project or not asset: raise HTTPException(status_code=404, detail="Not found")
    if asset not in project.assets:
        project.assets.append(asset)
        await db.commit()
    return {"message": "Linked"}

@app.post("/projects/{project_id}/assets/unlink/{asset_id}")
async def unlink_asset_from_project(project_id: str, asset_id: str, db: AsyncSession = Depends(database.get_db)):
    p_res = await db.execute(select(models.Project).where(models.Project.id == project_id).options(selectinload(models.Project.assets)))
    project = p_res.scalar_one_or_none()
    a_res = await db.execute(select(models.Asset).where(models.Asset.id == asset_id))
    asset = a_res.scalar_one_or_none()
    
    if not project or not asset: raise HTTPException(status_code=404, detail="Not found")
    if asset in project.assets:
        project.assets.remove(asset)
        await db.commit()
    return {"message": "Unlinked"}

@app.post("/projects/{project_id}/scenes", response_model=schemas.Scene)
async def create_scene(project_id: str, scene: schemas.SceneCreate, db: AsyncSession = Depends(database.get_db)):
    db_scene = models.Scene(project_id=project_id, **scene.model_dump())
    db.add(db_scene)
    await db.commit()
    
    # Reload with selectinload to avoid validation errors
    result = await db.execute(
        select(models.Scene).where(models.Scene.id == db_scene.id).options(
            selectinload(models.Scene.first_frame_asset),
            selectinload(models.Scene.last_frame_asset)
        )
    )
    s = result.scalar_one()
    if s.first_frame_asset: s.first_frame_asset.public_url = f"{BASE_URL}{s.first_frame_asset.file_path}"
    if s.last_frame_asset: s.last_frame_asset.public_url = f"{BASE_URL}{s.last_frame_asset.file_path}"
    return s

@app.post("/projects/{project_id}/scenes/{scene_id}/generate")
async def trigger_generation(project_id: str, scene_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(run_video_generation, project_id, scene_id, database.SessionLocal)
    return {"message": "Started"}

@app.get("/projects/{project_id}/scenes/{scene_id}/status", response_model=schemas.Scene)
async def get_scene_status(project_id: str, scene_id: str, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(
        select(models.Scene).where(models.Scene.id == scene_id).options(
            selectinload(models.Scene.first_frame_asset),
            selectinload(models.Scene.last_frame_asset)
        )
    )
    scene = result.scalar_one_or_none()
    if not scene: raise HTTPException(status_code=404, detail="Scene not found")
    scene.public_url = f"{BASE_URL}{scene.video_path}" if scene.video_path else None
    if scene.first_frame_asset: scene.first_frame_asset.public_url = f"{BASE_URL}{scene.first_frame_asset.file_path}"
    if scene.last_frame_asset: scene.last_frame_asset.public_url = f"{BASE_URL}{scene.last_frame_asset.file_path}"
    return scene

@app.post("/projects/{project_id}/export")
async def export_project(project_id: str, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(select(models.Project).where(models.Project.id == project_id).options(selectinload(models.Project.scenes)))
    project = result.scalar_one_or_none()
    if not project: raise HTTPException(status_code=404, detail="Project not found")
    
    completed_scenes = sorted([s for s in project.scenes if s.status == "completed"], key=lambda x: x.order)
    if not completed_scenes: raise HTTPException(status_code=400, detail="No completed scenes")
    
    concat_content = "".join([f"file '{os.path.abspath(s.video_path.lstrip('/'))}'\n" for s in completed_scenes])
    list_path = os.path.join("data", "exports", f"{project_id}_list.txt")
    with open(list_path, "w") as f: f.write(concat_content)
    
    out_name = f"{project_id}_master.mp4"
    out_path = os.path.join("data", "exports", out_name)
    import subprocess
    try:
        subprocess.run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_path, "-c", "copy", out_path], check=True)
        return {"export_url": f"{BASE_URL}/data/exports/{out_name}"}
    except Exception as e:
        logger.error(f"FFmpeg failed: {e}")
        raise HTTPException(status_code=500, detail="Stitching failed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
