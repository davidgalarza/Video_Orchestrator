from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class AssetBase(BaseModel):
    type: str
    gcs_uri: str

class AssetCreate(AssetBase):
    project_id: str

class Asset(AssetBase):
    id: str
    project_id: str
    public_url: Optional[str] = None

    class Config:
        from_attributes = True

class SceneBase(BaseModel):
    order: int
    prompt: str

class SceneCreate(SceneBase):
    project_id: str

class Scene(SceneBase):
    id: str
    project_id: str
    status: str
    video_uri: Optional[str] = None
    public_url: Optional[str] = None
    operation_id: Optional[str] = None

    class Config:
        from_attributes = True

class ProjectBase(BaseModel):
    name: str
    system_prompt: Optional[str] = None

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: str
    created_at: datetime
    assets: List[Asset] = []
    scenes: List[Scene] = []

    class Config:
        from_attributes = True
