import logging
import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.client import Client
from app.models.invoice import Invoice, InvoiceItem
from app.models.project import Project
from app.models.user import User
from app.schemas.invoice import InvoiceCreate, InvoiceRead, InvoiceUpdate
from app.services.invoices import (
    build_invoice_items,
    compute_invoice_totals,
    generate_invoice_number,
    render_invoice_html,
    write_invoice_pdf,
)

router = APIRouter()

logger = logging.getLogger(__name__)

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_owned_invoice(
    db: AsyncSession, user_id: uuid.UUID, invoice_id: uuid.UUID
) -> Invoice:
    invoice = await db.get(
        Invoice,
        invoice_id,
        options=[
            selectinload(Invoice.items),
            selectinload(Invoice.client),
            selectinload(Invoice.project),
        ],
    )
    if invoice is None or invoice.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found"
        )
    return invoice


async def validate_client(db: AsyncSession, user_id: uuid.UUID, client_id: uuid.UUID) -> None:
    client = await db.get(Client, client_id)
    if client is None or client.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Client not found"
        )


async def validate_project(
    db: AsyncSession, user_id: uuid.UUID, project_id: uuid.UUID | None
) -> None:
    if project_id is None:
        return
    project = await db.get(Project, project_id)
    if project is None or project.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Project not found"
        )


async def ensure_number_available(
    db: AsyncSession, user_id: uuid.UUID, invoice_number: str, exclude_id: uuid.UUID | None = None
) -> None:
    stmt = select(Invoice.id).where(
        Invoice.user_id == user_id, Invoice.invoice_number == invoice_number
    )
    if exclude_id is not None:
        stmt = stmt.where(Invoice.id != exclude_id)
    existing = await db.scalar(stmt)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invoice number already exists",
        )


@router.get("", response_model=list[InvoiceRead])
async def list_invoices(db: DbSession, current_user: CurrentUser) -> list[Invoice]:
    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.items),
            selectinload(Invoice.client),
            selectinload(Invoice.project),
        )
        .where(Invoice.user_id == current_user.id)
        .order_by(Invoice.created_at.desc())
    )
    result = await db.scalars(stmt)
    return list(result.all())


@router.post(
    "",
    response_model=InvoiceRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_invoice(
    payload: InvoiceCreate, db: DbSession, current_user: CurrentUser
) -> Invoice:
    await validate_client(db, current_user.id, payload.client_id)
    await validate_project(db, current_user.id, payload.project_id)

    invoice_number = payload.invoice_number or await generate_invoice_number(
        db, current_user.id
    )
    await ensure_number_available(db, current_user.id, invoice_number)

    items = build_invoice_items(payload.items)
    subtotal, tax_amount, total = compute_invoice_totals(items, payload.tax_rate)

    invoice = Invoice(
        user_id=current_user.id,
        client_id=payload.client_id,
        project_id=payload.project_id,
        invoice_number=invoice_number,
        issue_date=payload.issue_date or date.today(),
        due_date=payload.due_date,
        tax_rate=payload.tax_rate,
        status=payload.status,
        subtotal=subtotal,
        tax_amount=tax_amount,
        total=total,
        items=items,
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(
        invoice, attribute_names=["items", "client", "project"]
    )
    return invoice


@router.get("/{invoice_id}", response_model=InvoiceRead)
async def get_invoice(
    invoice_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> Invoice:
    return await get_owned_invoice(db, current_user.id, invoice_id)


@router.get("/{invoice_id}/pdf")
async def get_invoice_pdf(
    invoice_id: uuid.UUID, db: DbSession, current_user: CurrentUser
):
    invoice = await get_owned_invoice(db, current_user.id, invoice_id)

    try:
        pdf_path = write_invoice_pdf(invoice, render_invoice_html(invoice))
    except Exception:
        logger.exception(
            "PDF generation failed for invoice %s", invoice.invoice_number
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="PDF generation failed",
        )
    invoice.pdf_file_path = str(pdf_path)
    await db.commit()

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"{invoice.invoice_number}.pdf",
    )


@router.put("/{invoice_id}", response_model=InvoiceRead)
async def update_invoice(
    invoice_id: uuid.UUID,
    payload: InvoiceUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> Invoice:
    invoice = await get_owned_invoice(db, current_user.id, invoice_id)
    updates = payload.model_dump(exclude_unset=True)

    if "client_id" in updates:
        if updates["client_id"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invoice must be linked to a client",
            )
        await validate_client(db, current_user.id, updates["client_id"])
    if "project_id" in updates:
        await validate_project(db, current_user.id, updates["project_id"])
    if "invoice_number" in updates and updates["invoice_number"]:
        await ensure_number_available(
            db, current_user.id, updates["invoice_number"], exclude_id=invoice.id
        )

    for field in (
        "client_id",
        "project_id",
        "invoice_number",
        "issue_date",
        "due_date",
        "status",
    ):
        if field in updates:
            setattr(invoice, field, updates[field])

    if "tax_rate" in updates:
        invoice.tax_rate = updates["tax_rate"]

    if "items" in updates and updates["items"] is not None:
        new_items = build_invoice_items(updates["items"])
        invoice.items.clear()
        invoice.items.extend(new_items)

    subtotal, tax_amount, total = compute_invoice_totals(
        invoice.items, invoice.tax_rate
    )
    invoice.subtotal = subtotal
    invoice.tax_amount = tax_amount
    invoice.total = total

    await db.commit()
    await db.refresh(invoice, attribute_names=["items", "client", "project"])
    return invoice


@router.delete("/{invoice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_invoice(
    invoice_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> None:
    invoice = await get_owned_invoice(db, current_user.id, invoice_id)
    await db.delete(invoice)
    await db.commit()
