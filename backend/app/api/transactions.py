import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.client import Client
from app.models.project import Project
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionRead, TransactionUpdate

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def get_owned_transaction(
    db: AsyncSession, user_id: uuid.UUID, transaction_id: uuid.UUID
) -> Transaction:
    transaction = await db.get(
        Transaction,
        transaction_id,
        options=[
            selectinload(Transaction.project),
            selectinload(Transaction.client),
        ],
    )
    if transaction is None or transaction.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found"
        )
    return transaction


async def validate_links(
    db: AsyncSession,
    user_id: uuid.UUID,
    project_id: uuid.UUID | None,
    client_id: uuid.UUID | None,
) -> None:
    if project_id is not None:
        project = await db.get(Project, project_id)
        if project is None or project.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Project not found"
            )
    if client_id is not None:
        client = await db.get(Client, client_id)
        if client is None or client.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Client not found"
            )


@router.get("", response_model=list[TransactionRead])
async def list_transactions(
    db: DbSession,
    current_user: CurrentUser,
    project_id: uuid.UUID | None = Query(default=None),
    client_id: uuid.UUID | None = Query(default=None),
    type_filter: str | None = Query(default=None, alias="type"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
) -> list[Transaction]:
    stmt = (
        select(Transaction)
        .options(
            selectinload(Transaction.project),
            selectinload(Transaction.client),
        )
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.date.desc(), Transaction.created_at.desc())
    )
    if project_id is not None:
        stmt = stmt.where(Transaction.project_id == project_id)
    if client_id is not None:
        stmt = stmt.where(Transaction.client_id == client_id)
    if type_filter is not None:
        stmt = stmt.where(Transaction.type == type_filter)
    if date_from is not None:
        stmt = stmt.where(Transaction.date >= date_from)
    if date_to is not None:
        stmt = stmt.where(Transaction.date <= date_to)
    result = await db.scalars(stmt)
    return list(result.all())


@router.post(
    "",
    response_model=TransactionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_transaction(
    payload: TransactionCreate, db: DbSession, current_user: CurrentUser
) -> Transaction:
    await validate_links(db, current_user.id, payload.project_id, payload.client_id)
    transaction = Transaction(user_id=current_user.id, **payload.model_dump())
    db.add(transaction)
    await db.commit()
    await db.refresh(
        transaction,
        attribute_names=["project", "client"],
    )
    return transaction


@router.get("/{transaction_id}", response_model=TransactionRead)
async def get_transaction(
    transaction_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> Transaction:
    return await get_owned_transaction(db, current_user.id, transaction_id)


@router.put("/{transaction_id}", response_model=TransactionRead)
async def update_transaction(
    transaction_id: uuid.UUID,
    payload: TransactionUpdate,
    db: DbSession,
    current_user: CurrentUser,
) -> Transaction:
    transaction = await get_owned_transaction(db, current_user.id, transaction_id)
    updates = payload.model_dump(exclude_unset=True)
    await validate_links(
        db,
        current_user.id,
        updates.get("project_id"),
        updates.get("client_id"),
    )
    for field, value in updates.items():
        setattr(transaction, field, value)
    await db.commit()
    await db.refresh(
        transaction,
        attribute_names=["project", "client"],
    )
    return transaction


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> None:
    transaction = await get_owned_transaction(db, current_user.id, transaction_id)
    await db.delete(transaction)
    await db.commit()
