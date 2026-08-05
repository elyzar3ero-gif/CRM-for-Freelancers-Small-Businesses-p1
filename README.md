# CRM for Freelancers & Small Businesses

A CRM built with FastAPI (SQLAlchemy, PostgreSQL, Alembic) on the backend and
React + TypeScript (Vite) on the frontend. Authentication is JWT-based with the
OAuth2 password flow.

## Features implemented so far

- User registration and login (JWT access tokens, `passlib`/bcrypt hashing).
- Protected endpoints scoped per authenticated user.
- CRUD for **Clients** and **Leads** (list with search, create, read, update, delete).
- **Pipeline** for leads: customizable stages with CRUD, a Kanban board with
  drag-and-drop, and a `PUT /leads/{id}/move` endpoint. New users get default
  stages; new leads are auto-assigned to the first stage. Leads in the final
  stage (highest order, or named "Won"/"Ganado") can be converted into clients.
- **Projects** management: CRUD, linked to a client, filterable by client/status,
  with quick status updates.
- **Transactions** (income & expenses): CRUD, filterable by project/client/type/date
  range, with income/expense/net totals.
- **Invoices**: CRUD with dynamic line items, automatic invoice numbering
  (`INV-YYYY-0001`), computed subtotal/tax/total, and PDF generation
  (`GET /invoices/{id}/pdf`). Download the PDF from the Invoices page.
- **Dashboard**: home page after login with KPI cards (monthly income/expenses,
  active projects, conversion rate), a 12-month income bar chart (Recharts), and
  leads-per-stage summary.
- **Lead conversion**: `POST /leads/{id}/convert` turns a "won" lead into a
  Client, with a "Convert to Client" button on the Kanban board.
- Docker Compose with hot-reload dev servers for backend and frontend.

## Tech stack

- **Backend:** FastAPI, SQLAlchemy 2 (async), asyncpg, Alembic, Pydantic v2, python-jose, passlib.
- **Frontend:** React 18, TypeScript, Vite, Axios, React Router, Recharts, `@hello-pangea/dnd`.
- **Database:** PostgreSQL 15.

## Project structure

```
.
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── alembic/            # Alembic env + migrations
│   └── app/
│       ├── main.py         # FastAPI app, /health
│       ├── core/           # config, database, security
│       ├── models/         # User, Client, Lead, PipelineStage, Project, Transaction
│       ├── schemas/        # Pydantic models
│       └── api/            # auth, clients, leads, pipeline-stages, projects, transactions
└── frontend/
    ├── Dockerfile
    └── src/
        ├── api/            # Axios instance + API modules (auth, clients, leads, pipeline-stages, projects, transactions, invoices, dashboard)
        ├── context/        # Auth context
        ├── components/     # Layout, ProtectedRoute, Table
        └── pages/          # Login, Register, Dashboard, Clients, Leads, Pipeline, Projects, Transactions, Invoices
```

## Getting started (Docker Compose)

Requirements: Docker with the Compose plugin.

```bash
docker compose up --build
```

- Frontend (Vite dev server): http://localhost:5173
- Backend API: http://localhost:8000
  - Interactive docs (Swagger UI): http://localhost:8000/docs
  - Health check: http://localhost:8000/health
- PostgreSQL: `localhost:5432` (user/password/db: `crm`/`crm`/`crm`)

On startup the backend automatically runs `alembic upgrade head` before
starting the server, so the database schema is always up to date.

To stop: `docker compose down` (add `-v` to also remove the database volume).

## Running without Docker

### Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate  |  Unix: source .venv/bin/activate
pip install -r requirements.txt

# Set the database URL (adjust host if not using the compose Postgres)
$env:DATABASE_URL = "postgresql+asyncpg://crm:crm@localhost:5432/crm"   # PowerShell
# export DATABASE_URL="postgresql+asyncpg://crm:crm@localhost:5432/crm" # Unix

alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/auth`, `/clients`, `/leads`, `/pipeline-stages`,
`/projects`, `/transactions`, `/invoices`, `/dashboard` and `/health` to the
backend on `http://backend:8000` (inside Compose). If you run the backend
locally instead, create `frontend/.env.local` with:

```
VITE_API_URL=http://localhost:8000
```

## API endpoints

| Method | Path                    | Auth   | Description                        |
| ------ | ----------------------- | ------ | ---------------------------------- |
| GET    | `/health`               | no     | Health check                       |
| POST   | `/auth/register`        | no     | Create account (seeds default stages) |
| POST   | `/auth/login`           | no     | Returns `{ access_token }`         |
| GET    | `/auth/me`              | bearer | Current user                       |
| GET    | `/clients`              | bearer | List clients (`?search=`)          |
| POST   | `/clients`              | bearer | Create client                      |
| GET    | `/clients/{id}`         | bearer | Get client                         |
| PUT    | `/clients/{id}`         | bearer | Update client                      |
| DELETE | `/clients/{id}`         | bearer | Delete client                      |
| GET    | `/leads`                | bearer | List leads (`?search=`)            |
| POST   | `/leads`                | bearer | Create lead (auto-assigns first stage) |
| GET    | `/leads/{id}`           | bearer | Get lead                           |
| PUT    | `/leads/{id}`           | bearer | Update lead                        |
| PUT    | `/leads/{id}/move`      | bearer | Move lead to a pipeline stage      |
| DELETE | `/leads/{id}`           | bearer | Delete lead                        |
| GET    | `/pipeline-stages`      | bearer | List pipeline stages (by order)    |
| POST   | `/pipeline-stages`      | bearer | Create stage                       |
| GET    | `/pipeline-stages/{id}` | bearer | Get stage                          |
| PUT    | `/pipeline-stages/{id}` | bearer | Rename/reorder stage               |
| DELETE | `/pipeline-stages/{id}` | bearer | Delete stage (leads unassigned)    |
| GET    | `/projects`             | bearer | List projects (`?client_id=`, `?status=`) |
| POST   | `/projects`             | bearer | Create project (requires `client_id`) |
| GET    | `/projects/{id}`        | bearer | Get project                        |
| PUT    | `/projects/{id}`        | bearer | Update project                     |
| DELETE | `/projects/{id}`        | bearer | Delete project                     |
| GET    | `/transactions`         | bearer | List transactions (`?project_id=`, `?client_id=`, `?type=`, `?date_from=`, `?date_to=`) |
| POST   | `/transactions`         | bearer | Create transaction                 |
| GET    | `/transactions/{id}`    | bearer | Get transaction                    |
| PUT    | `/transactions/{id}`    | bearer | Update transaction                 |
| DELETE | `/transactions/{id}`    | bearer | Delete transaction                 |
| GET    | `/invoices`             | bearer | List invoices                      |
| POST   | `/invoices`             | bearer | Create invoice (items, auto numbering) |
| GET    | `/invoices/{id}`        | bearer | Get invoice (with items)           |
| PUT    | `/invoices/{id}`        | bearer | Update invoice (recomputes totals) |
| DELETE | `/invoices/{id}`        | bearer | Delete invoice                     |
| GET    | `/invoices/{id}/pdf`    | bearer | Download invoice as PDF file       |
| POST   | `/leads/{id}/convert`   | bearer | Convert a won lead into a client   |
| GET    | `/dashboard`            | bearer | KPIs: monthly income/expenses, active projects, 12-month income, leads per stage, conversion rate |

All records are scoped to the authenticated user.

## Invoice PDF download

The PDF is generated server-side with WeasyPrint (`backend/app/templates/invoice.html`).
On the **Invoices** page, click **Download PDF** on any row. The frontend fetches
`GET /invoices/{id}/pdf` as a binary blob and saves it as
`{invoice_number}.pdf` (e.g. `INV-2026-0001.pdf`).


```

Note: WeasyPrint needs the GTK/Pango system libraries. The bundled Docker image
already includes them, so `docker compose up` works out of the box. On a plain
Windows install without Pango the endpoint returns `500 PDF generation failed`.

