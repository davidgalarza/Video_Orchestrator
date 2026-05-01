from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Table, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

# Association table for Project <-> Asset many-to-many relationship
project_assets = Table(
    "project_assets",
    Base.metadata,
    Column("project_id", String, ForeignKey("projects.id"), primary_key=True),
    Column("asset_id", String, ForeignKey("assets.id"), primary_key=True),
)

class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    scenes = relationship("Scene", back_populates="project", cascade="all, delete-orphan")
    assets = relationship("Asset", secondary=project_assets, back_populates="projects")

class Asset(Base):
    __tablename__ = "assets"
    id = Column(String, primary_key=True, default=generate_uuid)
    type = Column(String)  # CHARACTER, PRODUCT, STYLE
    file_path = Column(String)
    is_global = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    projects = relationship("Project", secondary=project_assets, back_populates="assets")

class Scene(Base):
    __tablename__ = "scenes"
    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"))
    order = Column(Integer)
    prompt = Column(String)
    status = Column(String, default="pending")  # pending, processing, completed, failed
    video_path = Column(String, nullable=True)
    first_frame_asset_id = Column(String, ForeignKey("assets.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="scenes")
    first_frame_asset = relationship("Asset")

class GlobalSettings(Base):
    __tablename__ = "global_settings"
    id = Column(Integer, primary_key=True, default=1) # Singleton
    model_id = Column(String, default="veo-3.1-generate-preview")
    aspect_ratio = Column(String, default="16:9") # 16:9 or 9:16
    global_prompt_prefix = Column(String, default="")
    global_prompt_suffix = Column(String, default="cinematic, high detail, 8k")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
