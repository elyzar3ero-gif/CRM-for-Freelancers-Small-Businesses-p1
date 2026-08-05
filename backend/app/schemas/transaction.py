import uuid
from datetime import datetime
from datetime import date as date_type
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.client import ClientRead
from app.schemas.project import ProjectRead

TransactionType = Literal["income", "expense"]


class TransactionBase(BaseModel):
    project_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    type: TransactionType
    category: str | None = Field(default=None, max_length=255)
    amount: float = Field(gt=0)
    date: date_type
    description: str | None = Field(default=None, max_length=500)


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    project_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    type: TransactionType | None = None
    category: str | None = Field(default=None, max_length=255)
    amount: float | None = Field(default=None, gt=0)
    date: date_type | None = None
    description: str | None = Field(default=None, max_length=500)


class TransactionRead(TransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    project: ProjectRead | None
    client: ClientRead | None
    created_at: datetime
