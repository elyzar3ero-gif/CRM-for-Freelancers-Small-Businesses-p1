import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.client import ClientRead
from app.schemas.project import ProjectRead

InvoiceStatus = Literal["draft", "sent", "paid"]


class InvoiceItemInput(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    quantity: float = Field(default=1, gt=0)
    unit_price: float = Field(gt=0)


class InvoiceItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    invoice_id: uuid.UUID
    description: str
    quantity: float
    unit_price: float
    total: float


class InvoiceBase(BaseModel):
    client_id: uuid.UUID
    project_id: uuid.UUID | None = None
    invoice_number: str | None = Field(default=None, max_length=50)
    issue_date: date | None = None
    due_date: date | None = None
    tax_rate: float = Field(default=0, ge=0, le=100)
    status: InvoiceStatus = "draft"


class InvoiceCreate(InvoiceBase):
    items: list[InvoiceItemInput] = Field(default_factory=list)


class InvoiceUpdate(BaseModel):
    client_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    invoice_number: str | None = Field(default=None, max_length=50)
    issue_date: date | None = None
    due_date: date | None = None
    tax_rate: float | None = Field(default=None, ge=0, le=100)
    status: InvoiceStatus | None = None
    items: list[InvoiceItemInput] | None = None


class InvoiceRead(InvoiceBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    subtotal: float
    tax_rate: float
    tax_amount: float
    total: float
    pdf_file_path: str | None
    client: ClientRead | None
    project: ProjectRead | None
    items: list[InvoiceItemRead]
    created_at: datetime
