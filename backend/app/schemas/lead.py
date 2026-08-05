import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.client import ClientRead
from app.schemas.pipeline_stage import PipelineStageRead


class LeadBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    source: str | None = Field(default=None, max_length=255)
    status: str = Field(default="new", max_length=50)
    estimated_value: float | None = Field(default=None, ge=0)
    notes: str | None = None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=50)
    source: str | None = Field(default=None, max_length=255)
    status: str | None = Field(default=None, max_length=50)
    estimated_value: float | None = Field(default=None, ge=0)
    notes: str | None = None


class LeadMoveRequest(BaseModel):
    stage_id: uuid.UUID


class LeadRead(LeadBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    client_converted_id: uuid.UUID | None
    current_stage_id: uuid.UUID | None
    status_changed_at: datetime | None
    current_stage: PipelineStageRead | None
    client: ClientRead | None
    created_at: datetime
