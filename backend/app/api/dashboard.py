import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.lead import Lead
from app.models.pipeline_stage import PipelineStage
from app.models.project import Project
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.dashboard import (
    DashboardRead,
    MonthlyIncomeItem,
    StageCount,
)

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]

MONTHS = 12


def add_months(year: int, month: int, offset: int) -> tuple[int, int]:
    total = year * 12 + (month - 1) + offset
    return total // 12, (total % 12) + 1


@router.get("", response_model=DashboardRead)
async def get_dashboard(db: DbSession, current_user: CurrentUser) -> DashboardRead:
    today = date.today()
    month_start = today.replace(day=1)
    next_month_year, next_month_month = add_months(
        today.year, today.month, 1
    )
    next_month_start = date(next_month_year, next_month_month, 1)
    start_year, start_month = add_months(today.year, today.month, -(MONTHS - 1))
    history_start = date(start_year, start_month, 1)

    # Income and expenses for the current month.
    income_this_month = await db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == current_user.id,
            Transaction.type == "income",
            Transaction.date >= month_start,
            Transaction.date < next_month_start,
        )
    )
    expenses_this_month = await db.scalar(
        select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.user_id == current_user.id,
            Transaction.type == "expense",
            Transaction.date >= month_start,
            Transaction.date < next_month_start,
        )
    )

    active_projects = await db.scalar(
        select(func.count(Project.id)).where(
            Project.user_id == current_user.id,
            Project.status == "in_progress",
        )
    )

    leads_total = await db.scalar(
        select(func.count(Lead.id)).where(Lead.user_id == current_user.id)
    )
    leads_won = await db.scalar(
        select(func.count(Lead.id)).where(
            Lead.user_id == current_user.id, Lead.status == "won"
        )
    )
    conversion_rate = round(
        (leads_won / leads_total * 100) if leads_total else 0.0, 2
    )

    # Monthly income for the last 12 months.
    year_expr = func.extract("year", Transaction.date).label("year")
    month_expr = func.extract("month", Transaction.date).label("month")
    total_expr = func.sum(Transaction.amount).label("total")
    rows = await db.execute(
        select(year_expr, month_expr, total_expr)
        .where(
            Transaction.user_id == current_user.id,
            Transaction.type == "income",
            Transaction.date >= history_start,
        )
        .group_by(year_expr, month_expr)
    )
    monthly_map = {
        (int(row.year), int(row.month)): float(row.total)
        for row in rows.all()
    }
    monthly_income = []
    for offset in range(MONTHS):
        y, m = add_months(today.year, today.month, -offset)
        monthly_income.append(
            MonthlyIncomeItem(
                month=f"{y:04d}-{m:02d}",
                total=monthly_map.get((y, m), 0.0),
            )
        )
    monthly_income.reverse()

    # Lead counts grouped by pipeline stage.
    stage_rows = await db.execute(
        select(
            PipelineStage.id.label("stage_id"),
            PipelineStage.name.label("name"),
            func.count(Lead.id).label("count"),
        )
        .select_from(PipelineStage)
        .outerjoin(Lead, Lead.current_stage_id == PipelineStage.id)
        .where(PipelineStage.user_id == current_user.id)
        .group_by(PipelineStage.id, PipelineStage.name, PipelineStage.order)
        .order_by(PipelineStage.order.asc())
    )
    leads_by_stage = [
        StageCount(stage_id=row.stage_id, name=row.name, count=row.count)
        for row in stage_rows.all()
    ]

    return DashboardRead(
        income_this_month=float(income_this_month or 0),
        expenses_this_month=float(expenses_this_month or 0),
        active_projects=active_projects or 0,
        leads_by_stage=leads_by_stage,
        monthly_income=monthly_income,
        conversion_rate=conversion_rate,
    )
