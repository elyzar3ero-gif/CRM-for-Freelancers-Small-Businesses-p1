"""create pipeline_stages table and extend leads

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "pipeline_stages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column(
            "order",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_pipeline_stages_user_id"),
        "pipeline_stages",
        ["user_id"],
        unique=False,
    )

    op.add_column("leads", sa.Column("current_stage_id", sa.UUID(), nullable=True))
    op.add_column(
        "leads", sa.Column("status_changed_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.create_foreign_key(
        "fk_leads_current_stage_id_pipeline_stages",
        "leads",
        "pipeline_stages",
        ["current_stage_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        op.f("ix_leads_current_stage_id"),
        "leads",
        ["current_stage_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_leads_current_stage_id"), table_name="leads")
    op.drop_constraint(
        "fk_leads_current_stage_id_pipeline_stages", "leads", type_="foreignkey"
    )
    op.drop_column("leads", "status_changed_at")
    op.drop_column("leads", "current_stage_id")

    op.drop_index(op.f("ix_pipeline_stages_user_id"), table_name="pipeline_stages")
    op.drop_table("pipeline_stages")
