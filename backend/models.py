import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from database import Base

def generate_uuid():
    return str(uuid.uuid4())

from sqlalchemy.orm import relationship

class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    system_prompt = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    assets = relationship("Asset", back_populates="project", cascade="all, delete-orphan")
    scenes = relationship("Scene", back_populates="project", cascade="all, delete-orphan")

class Asset(Base):
    __tablename__ = "assets"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    type = Column(String, nullable=False)  # 'CHARACTER', 'PRODUCT', 'STYLE'
    gcs_uri = Column(String, nullable=False)

    project = relationship("Project", back_populates="assets")

class Scene(Base):
    __tablename__ = "scenes"

    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    order = Column(Integer, nullable=False)
    prompt = Column(Text, nullable=False)
    status = Column(String, default="pending")  # 'pending', 'processing', 'completed', 'failed'
    video_uri = Column(String, nullable=True)
    operation_id = Column(String, nullable=True)

    project = relationship("Project", back_populates="scenes")
