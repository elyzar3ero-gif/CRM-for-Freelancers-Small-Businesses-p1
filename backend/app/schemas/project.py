import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.client import ClientRead

ProjectStatus = Literal["planned", "in_progress", "completed", "cancelled"]


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    status: ProjectStatus = "planned"
    start_date: date | None = None
    estimated_end_date: date | None = None
    actual_end_date: date | None = None
    total_value: float | None = Field(default=None, ge=0)


class ProjectCreate(ProjectBase):
    client_id: uuid.UUID


class ProjectUpdate(BaseModel):
    client_id: uuid.UUID | None = None
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: ProjectStatus | None = None
    start_date: date | None = None
    estimated_end_date: date | None = None
    actual_end_date: date | None = None
    total_value: float | None = Field(default=None, ge=0)


class ProjectRead(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    client_id: uuid.UUID
    client: ClientRead | None
    created_at: datetime
