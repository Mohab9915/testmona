"""Add optional Azure DevOps parent work item fields to defects

Revision ID: add_defect_ado_parent
Revises: add_user_items_per_page
Create Date: 2026-08-30 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

from app.services.migration_helpers import add_column_if_missing, drop_column_if_exists


revision = "add_defect_ado_parent"
down_revision = "add_user_items_per_page"
branch_labels = None
depends_on = None


def upgrade() -> None:
    add_column_if_missing(
        op,
        "defects",
        sa.Column("ado_parent_work_item_id", sa.String(length=50), nullable=True),
    )
    add_column_if_missing(
        op,
        "defects",
        sa.Column("ado_parent_title", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    drop_column_if_exists(op, "defects", "ado_parent_title")
    drop_column_if_exists(op, "defects", "ado_parent_work_item_id")
