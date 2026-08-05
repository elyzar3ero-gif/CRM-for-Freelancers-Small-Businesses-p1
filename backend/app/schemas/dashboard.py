import uuid

from pydantic import BaseModel


class StageCount(BaseModel):
    stage_id: uuid.UUID
    name: str
    count: int


class MonthlyIncomeItem(BaseModel):
    month: str
    total: float


class DashboardRead(BaseModel):
    income_this_month: float
    expenses_this_month: float
    active_projects: int
    leads_by_stage: list[StageCount]
    monthly_income: list[MonthlyIncomeItem]
    conversion_rate: float
