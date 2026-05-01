from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class AssetBase(BaseModel):
    type: str
    file_path: str
    is_global: bool = False

class AssetCreate(AssetBase):
    pass

class Asset(AssetBase):
    id: str
    created_at: datetime
    public_url: Optional[str] = None

    class Config:
        from_attributes = True

class SceneBase(BaseModel):
    order: int
    prompt: str
    first_frame_asset_id: Optional[str] = None

class SceneCreate(SceneBase):
    pass

class Scene(SceneBase):
    id: str
    project_id: str
    status: str
    video_path: Optional[str] = None
    public_url: Optional[str] = None
    created_at: datetime
    first_frame_asset: Optional[Asset] = None

    class Config:
        from_attributes = True

class ProjectBase(BaseModel):
    name: str

class ProjectCreate(ProjectBase):
    pass

class Project(ProjectBase):
    id: str
    created_at: datetime
    assets: List[Asset]
    scenes: List[Scene]

    class Config:
        from_attributes = True

class GlobalSettingsBase(BaseModel):
    model_id: str
    aspect_ratio: str
    global_prompt_prefix: str
    global_prompt_suffix: str

class GlobalSettingsUpdate(BaseModel):
    model_id: Optional[str] = None
    aspect_ratio: Optional[str] = None
    global_prompt_prefix: Optional[str] = None
    global_prompt_suffix: Optional[str] = None

class GlobalSettings(GlobalSettingsBase):
    updated_at: datetime

    class Config:
        from_attributes = True
