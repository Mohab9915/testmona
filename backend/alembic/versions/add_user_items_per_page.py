"""Add items_per_page column to users for persisted pagination preference

Revision ID: add_user_items_per_page
Revises: add_doc_version_name
Create Date: 2026-08-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

from app.services.migration_helpers import add_column_if_missing, drop_column_if_exists


revision = "add_user_items_per_page"
down_revision = "add_doc_version_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    add_column_if_missing(
        op,
        "users",
        sa.Column("items_per_page", sa.Integer(), nullable=False, server_default="10"),
    )


def downgrade() -> None:
    drop_column_if_exists(op, "users", "items_per_page")