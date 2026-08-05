from datetime import datetime
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from app.core.config import settings
from app.models.invoice import Invoice, InvoiceItem
from app.schemas.invoice import InvoiceItemInput

BUSINESS_INFO = {
    "name": "Freelance Studio",
    "address": "123 Main Street, Suite 100\nSpringfield, ST 12345",
    "email": "hello@freelancestudio.example",
    "phone": "+1 (555) 000-1234",
    "tax_id": "TAX-987654321",
}

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
_env = Environment(loader=FileSystemLoader(str(_TEMPLATE_DIR)))
_env.filters["money"] = lambda value: f"{Decimal(value):,.2f}"


def build_invoice_items(payload_items: list[InvoiceItemInput]) -> list[InvoiceItem]:
    items = []
    for index, payload in enumerate(payload_items):
        if not isinstance(payload, InvoiceItemInput):
            payload = InvoiceItemInput.model_validate(payload)
        quantity = Decimal(str(payload.quantity))
        unit_price = Decimal(str(payload.unit_price))
        total = (quantity * unit_price).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        items.append(
            InvoiceItem(
                position=index,
                description=payload.description,
                quantity=quantity,
                unit_price=unit_price,
                total=total,
            )
        )
    return items


def compute_invoice_totals(
    items: list[InvoiceItem], tax_rate: float
) -> tuple[Decimal, Decimal, Decimal]:
    subtotal = sum((item.total for item in items), Decimal("0")).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    tax_amount = (subtotal * Decimal(str(tax_rate)) / Decimal(100)).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    total = subtotal + tax_amount
    return subtotal, tax_amount, total


async def generate_invoice_number(db, user_id) -> str:
    from sqlalchemy import select

    year = datetime.now().year
    existing = await db.scalars(
        select(Invoice.invoice_number).where(Invoice.user_id == user_id)
    )
    numbers = set(existing.all())
    sequence = 1
    while f"INV-{year}-{sequence:04d}" in numbers:
        sequence += 1
    return f"INV-{year}-{sequence:04d}"


def render_invoice_html(invoice: Invoice) -> str:
    template = _env.get_template("invoice.html")
    return template.render(invoice=invoice, business=BUSINESS_INFO)


def write_invoice_pdf(invoice: Invoice, html: str) -> Path:
    from weasyprint import HTML

    storage_dir = Path(settings.PDF_STORAGE_DIR)
    storage_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = storage_dir / f"{invoice.invoice_number}.pdf"
    HTML(string=html).write_pdf(str(pdf_path))
    return pdf_path
