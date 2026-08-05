import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.client import Client
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_owned_project(
    db: AsyncSession, user_id: uuid.UUID, project_id: uuid.UUID
) -> Project:
    project = await db.get(
        Project, project_id, options=[selectinload(Project.client)]
    )
    if project is None or project.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return project


async def validate_client(db: AsyncSession, user_id: uuid.UUID, client_id: uuid.UUID) -> None:
    client = await db.get(Client, client_id)
    if client is None or client.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Client not found"
        )


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    db: DbSession,
    current_user: CurrentUser,
    client_id: uuid.UUID | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
) -> list[Project]:
    stmt = (
        select(Project)
        .options(selectinload(Project.client))
        .where(Project.user_id == current_user.id)
        .order_by(Project.created_at.desc())
    )
    if client_id is not None:
        stmt = stmt.where(Project.client_id == client_id)
    if status_filter is not None:
        stmt = stmt.where(Project.status == status_filter)
    result = await db.scalars(stmt)
    return list(result.all())


@router.post(
    "",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_project(
    payload: ProjectCreate, db: DbSession, current_user: CurrentUser
) -> Project:
    await validate_client(db, current_user.id, payload.client_id)
    project = Project(user_id=current_user.id, **payload.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project, attribute_names=["client"])
    return project


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> Project:
    return await get_owned_project(db, current_user.id, project_id)


@router.put("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> Project:
    project = await get_owned_project(db, current_user.id, project_id)
    updates = payload.model_dump(exclude_unset=True)
    if "client_id" in updates:
        if updates["client_id"] is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project must be linked to a client",
            )
        await validate_client(db, current_user.id, updates["client_id"])
    for field, value in updates.items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project, attribute_names=["client"])
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> None:
    project = await get_owned_project(db, current_user.id, project_id)
    await db.delete(project)
    await db.commit()
