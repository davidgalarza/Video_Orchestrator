from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class AssetBase(BaseModel):
    type: str
    file_path: Optional[str] = None

class Asset(AssetBase):
    id: str
    project_id: str
    public_url: Optional[str] = None
    class Config: from_attributes = True

class SceneBase(BaseModel):
    order: int
    prompt: str

class Scene(SceneBase):
    id: str
    project_id: str
    status: str
    video_path: Optional[str] = None
    public_url: Optional[str] = None
    class Config: from_attributes = True

class ProjectBase(BaseModel):
    name: str

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: str
    created_at: datetime
    assets: List[Asset] = []
    scenes: List[Scene] = []
    class Config: from_attributes = True
