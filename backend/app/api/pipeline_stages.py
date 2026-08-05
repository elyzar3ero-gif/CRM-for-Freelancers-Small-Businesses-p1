import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.pipeline_stage import PipelineStage
from app.models.user import User
from app.schemas.pipeline_stage import (
    PipelineStageCreate,
    PipelineStageRead,
    PipelineStageUpdate,
)

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_owned_stage(
    db: AsyncSession, user_id: uuid.UUID, stage_id: uuid.UUID
) -> PipelineStage:
    stage = await db.get(PipelineStage, stage_id)
    if stage is None or stage.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Pipeline stage not found"
        )
    return stage


@router.get("", response_model=list[PipelineStageRead])
async def list_pipeline_stages(
    db: DbSession, current_user: CurrentUser
) -> list[PipelineStage]:
    stmt = (
        select(PipelineStage)
        .where(PipelineStage.user_id == current_user.id)
        .order_by(PipelineStage.order.asc(), PipelineStage.name.asc())
    )
    result = await db.scalars(stmt)
    return list(result.all())


@router.post(
    "",
    response_model=PipelineStageRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_pipeline_stage(
    payload: PipelineStageCreate, db: DbSession, current_user: CurrentUser
) -> PipelineStage:
    order = payload.order
    if order is None:
        max_order = await db.scalar(
            select(func.max(PipelineStage.order)).where(
                PipelineStage.user_id == current_user.id
            )
        )
        order = (max_order + 1) if max_order is not None else 0

    stage = PipelineStage(user_id=current_user.id, name=payload.name, order=order)
    db.add(stage)
    await db.commit()
    await db.refresh(stage)
    return stage


@router.get("/{stage_id}", response_model=PipelineStageRead)
async def get_pipeline_stage(
    stage_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> PipelineStage:
    return await get_owned_stage(db, current_user.id, stage_id)


@router.put("/{stage_id}", response_model=PipelineStageRead)
async def update_pipeline_stage(
    stage_id: uuid.UUID,
    payload: PipelineStageUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> PipelineStage:
    stage = await get_owned_stage(db, current_user.id, stage_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(stage, field, value)
    await db.commit()
    await db.refresh(stage)
    return stage


@router.delete("/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pipeline_stage(
    stage_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> None:
    stage = await get_owned_stage(db, current_user.id, stage_id)
    await db.delete(stage)
    await db.commit()
