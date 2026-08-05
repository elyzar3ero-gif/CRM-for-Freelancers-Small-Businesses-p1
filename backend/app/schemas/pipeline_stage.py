import uuid

from pydantic import BaseModel, ConfigDict, Field


class PipelineStageBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class PipelineStageCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    order: int | None = Field(default=None, ge=0)


class PipelineStageUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    order: int | None = Field(default=None, ge=0)


class PipelineStageRead(PipelineStageBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    order: int
