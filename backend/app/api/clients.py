import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.client import Client
from app.models.user import User
from app.schemas.client import ClientCreate, ClientRead, ClientUpdate

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_owned_client(db: AsyncSession, user_id: uuid.UUID, client_id: uuid.UUID) -> Client:
    client = await db.get(Client, client_id)
    if client is None or client.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Client not found"
        )
    return client


@router.get("", response_model=list[ClientRead])
async def list_clients(
    db: DbSession,
    current_user: CurrentUser,
    search: str | None = Query(default=None),
) -> list[Client]:
    stmt = (
        select(Client)
        .where(Client.user_id == current_user.id)
        .order_by(Client.created_at.desc())
    )
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Client.name.ilike(pattern),
                Client.email.ilike(pattern),
                Client.company.ilike(pattern),
            )
        )
    result = await db.scalars(stmt)
    return list(result.all())


@router.post(
    "",
    response_model=ClientRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_client(
    payload: ClientCreate, db: DbSession, current_user: CurrentUser
) -> Client:
    client = Client(user_id=current_user.id, **payload.model_dump())
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientRead)
async def get_client(
    client_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> Client:
    return await get_owned_client(db, current_user.id, client_id)


@router.put("/{client_id}", response_model=ClientRead)
async def update_client(
    client_id: uuid.UUID,
    payload: ClientUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> Client:
    client = await get_owned_client(db, current_user.id, client_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    await db.commit()
    await db.refresh(client)
    return client


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_client(
    client_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> None:
    client = await get_owned_client(db, current_user.id, client_id)
    await db.delete(client)
    await db.commit()
