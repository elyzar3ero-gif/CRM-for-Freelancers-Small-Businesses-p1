from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import (
    auth,
    clients,
    dashboard,
    invoices,
    leads,
    pipeline_stages,
    projects,
    transactions,
)
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(clients.router, prefix="/clients", tags=["clients"])
app.include_router(leads.router, prefix="/leads", tags=["leads"])
app.include_router(
    pipeline_stages.router, prefix="/pipeline-stages", tags=["pipeline-stages"]
)
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
app.include_router(invoices.router, prefix="/invoices", tags=["invoices"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
