import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.client import Client
from app.models.lead import Lead
from app.models.pipeline_stage import PipelineStage
from app.models.user import User
from app.schemas.lead import LeadCreate, LeadMoveRequest, LeadRead, LeadUpdate

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_owned_lead(db: AsyncSession, user_id: uuid.UUID, lead_id: uuid.UUID) -> Lead:
    lead = await db.get(
        Lead, lead_id, options=[selectinload(Lead.current_stage), selectinload(Lead.client)]
    )
    if lead is None or lead.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found"
        )
    return lead


@router.get("", response_model=list[LeadRead])
async def list_leads(
    db: DbSession,
    current_user: CurrentUser,
    search: str | None = Query(default=None),
) -> list[Lead]:
    stmt = (
        select(Lead)
        .options(selectinload(Lead.current_stage), selectinload(Lead.client))
        .where(Lead.user_id == current_user.id)
        .order_by(Lead.created_at.desc())
    )
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Lead.name.ilike(pattern),
                Lead.email.ilike(pattern),
                Lead.source.ilike(pattern),
                Lead.status.ilike(pattern),
            )
        )
    result = await db.scalars(stmt)
    return list(result.all())


@router.post(
    "",
    response_model=LeadRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_lead(
    payload: LeadCreate, db: DbSession, current_user: CurrentUser
) -> Lead:
    lead = Lead(user_id=current_user.id, **payload.model_dump())
    if lead.current_stage_id is None:
        first_stage = await db.scalar(
            select(PipelineStage)
            .where(PipelineStage.user_id == current_user.id)
            .order_by(PipelineStage.order.asc(), PipelineStage.name.asc())
            .limit(1)
        )
        if first_stage is not None:
            lead.current_stage_id = first_stage.id
            lead.status_changed_at = datetime.now(timezone.utc)
    db.add(lead)
    await db.commit()
    await db.refresh(lead, attribute_names=["current_stage", "client"])
    return lead


@router.get("/{lead_id}", response_model=LeadRead)
async def get_lead(
    lead_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> Lead:
    return await get_owned_lead(db, current_user.id, lead_id)


@router.put("/{lead_id}", response_model=LeadRead)
async def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> Lead:
    lead = await get_owned_lead(db, current_user.id, lead_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(lead, field, value)
    await db.commit()
    await db.refresh(lead, attribute_names=["current_stage", "client"])
    return lead


@router.put("/{lead_id}/move", response_model=LeadRead)
async def move_lead(
    lead_id: uuid.UUID,
    payload: LeadMoveRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> Lead:
    lead = await get_owned_lead(db, current_user.id, lead_id)
    stage = await db.get(PipelineStage, payload.stage_id)
    if stage is None or stage.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline stage not found"
        )
    lead.current_stage_id = stage.id
    lead.status_changed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(lead, attribute_names=["current_stage", "client"])
    return lead


@router.post("/{lead_id}/convert", response_model=LeadRead)
async def convert_lead(
    lead_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> Lead:
    lead = await get_owned_lead(db, current_user.id, lead_id)
    if lead.client_converted_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lead already converted",
        )
    if not lead.name.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lead name is required to convert",
        )

    client = Client(
        user_id=current_user.id,
        name=lead.name.strip(),
        email=lead.email,
        phone=lead.phone,
        company=lead.source,
        notes=lead.notes,
    )
    db.add(client)
    await db.flush()

    lead.client_converted_id = client.id
    lead.status = "won"
    lead.status_changed_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(lead, attribute_names=["current_stage", "client"])
    return lead


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> None:
    lead = await get_owned_lead(db, current_user.id, lead_id)
    await db.delete(lead)
    await db.commit()
