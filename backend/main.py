from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
import uuid
import os
from contextlib import asynccontextmanager
from google.genai import types

import models, schemas, database, utils

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup
    async with database.engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
    yield

app = FastAPI(title="Veo Generative Video Orchestrator", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def generate_scene_video(project_id: str, scene_id: str, db: AsyncSession):
    # Fetch project, scene, and assets
    result = await db.execute(
        select(models.Project).where(models.Project.id == project_id).options(
            selectinload(models.Project.assets),
            selectinload(models.Project.scenes)
        )
    )
    project = result.scalar_one_or_none()
    if not project:
        return

    scene = next((s for s in project.scenes if s.id == scene_id), None)
    if not scene:
        return

    full_prompt = f"{project.system_prompt or ''} {scene.prompt}"
    reference_images = []
    for asset in project.assets:
        reference_images.append(types.VideoReferenceImage(
            uri=asset.gcs_uri,
            type=asset.type
        ))

    try:
        operation_id = utils.generate_video_veo(
            prompt=full_prompt,
            reference_images=reference_images
        )
        scene.status = "processing"
        scene.operation_id = operation_id
        await db.commit()
    except Exception as e:
        scene.status = "failed"
        await db.commit()
        print(f"Generation failed: {e}")

@app.post("/projects", response_model=schemas.Project)
async def create_project(project: schemas.ProjectCreate, db: AsyncSession = Depends(database.get_db)):
    # Convert Pydantic model to dict, compatible with V1 and V2
    project_data = project.model_dump() if hasattr(project, "model_dump") else project.dict()
    db_project = models.Project(**project_data)
    db.add(db_project)
    await db.commit()
    
    # Re-fetch with relationships loaded to avoid lazy-loading error
    result = await db.execute(
        select(models.Project).where(models.Project.id == db_project.id).options(
            selectinload(models.Project.assets),
            selectinload(models.Project.scenes)
        )
    )
    return result.scalar_one()

@app.get("/projects", response_model=List[schemas.Project])
async def get_projects(db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(
        select(models.Project).options(
            selectinload(models.Project.assets),
            selectinload(models.Project.scenes)
        )
    )
    projects = result.scalars().all()
    # Generate signed URLs for previews
    for p in projects:
        try:
            for a in p.assets:
                a.public_url = utils.generate_signed_url(a.gcs_uri)
            for s in p.scenes:
                if s.video_uri:
                    s.public_url = utils.generate_signed_url(s.video_uri)
        except Exception as e:
            print(f"Error processing URLs for project {p.id}: {e}")
    return projects

@app.get("/projects/{project_id}", response_model=schemas.Project)
async def get_project(project_id: str, db: AsyncSession = Depends(database.get_db)):
    result = await db.execute(
        select(models.Project).where(models.Project.id == project_id).options(
            selectinload(models.Project.assets),
            selectinload(models.Project.scenes)
        )
    )
    db_project = result.scalar_one_or_none()
    if db_project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Generate signed URLs
    for a in db_project.assets:
        a.public_url = utils.generate_signed_url(a.gcs_uri)
    for s in db_project.scenes:
        if s.video_uri:
            s.public_url = utils.generate_signed_url(s.video_uri)
            
    return db_project

@app.post("/projects/{project_id}/assets", response_model=schemas.Asset)
async def upload_asset(
    project_id: str,
    type: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(database.get_db)
):
    # Check if project exists first
    result = await db.execute(select(models.Project).where(models.Project.id == project_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    file_content = await file.read()
    file_ext = file.filename.split(".")[-1]
    destination_blob_name = f"projects/{project_id}/assets/{uuid.uuid4()}.{file_ext}"
    
    try:
        gcs_uri = utils.upload_to_gcs(file_content, destination_blob_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GCS Upload Error: {str(e)}")

    db_asset = models.Asset(project_id=project_id, type=type, gcs_uri=gcs_uri)
    db.add(db_asset)
    await db.commit()
    await db.refresh(db_asset)
    return db_asset

@app.post("/projects/{project_id}/scenes", response_model=schemas.Scene)
async def create_scene(
    project_id: str,
    scene: schemas.SceneBase,
    db: AsyncSession = Depends(database.get_db)
):
    scene_data = scene.model_dump() if hasattr(scene, "model_dump") else scene.dict()
    db_scene = models.Scene(project_id=project_id, **scene_data)
    db.add(db_scene)
    await db.commit()
    await db.refresh(db_scene)
    return db_scene

@app.post("/projects/{project_id}/scenes/{scene_id}/generate", response_model=schemas.Scene)
async def trigger_scene_generation(
    project_id: str,
    scene_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.Scene).where(models.Scene.id == scene_id))
    db_scene = result.scalar_one_or_none()
    if not db_scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    
    background_tasks.add_task(generate_scene_video, project_id, scene_id, db)
    return db_scene

@app.get("/projects/{project_id}/scenes/{scene_id}/status", response_model=schemas.Scene)
async def get_scene_status(
    project_id: str,
    scene_id: str,
    db: AsyncSession = Depends(database.get_db)
):
    result = await db.execute(select(models.Scene).where(models.Scene.id == scene_id))
    db_scene = result.scalar_one_or_none()
    if not db_scene:
        raise HTTPException(status_code=404, detail="Scene not found")
    
    if db_scene.status == "processing" and db_scene.operation_id:
        try:
            client = utils.genai.Client(vertexai=True, project=os.getenv("GOOGLE_CLOUD_PROJECT"), location="us-central1")
            operation = client.operations.get(name=db_scene.operation_id)
            
            if operation.done:
                if operation.result:
                    video_uri = operation.result.generated_videos[0].video_uri
                    db_scene.video_uri = video_uri
                    db_scene.status = "completed"
                elif operation.error:
                    db_scene.status = "failed"
                await db.commit()
                await db.refresh(db_scene)
        except Exception as e:
            print(f"Status check error: {e}")
            
    return db_scene

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
