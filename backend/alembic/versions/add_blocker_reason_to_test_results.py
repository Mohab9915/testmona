"""Add blocker_reason to test_results

Revision ID: add_blocker_reason_to_test_results
Revises: add_doc_granular_sharing
Create Date: 2026-06-05 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

from app.services.migration_helpers import (
    add_column_if_missing,
    drop_column_if_exists,
)


# revision identifiers, used by Alembic.
revision = 'add_blocker_reason_to_test_results'
down_revision = 'add_doc_granular_sharing'
branch_labels = None
depends_on = None


def upgrade() -> None:
    add_column_if_missing(
        op,
        'test_results',
        sa.Column('blocker_reason', sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    drop_column_if_exists(op, 'test_results', 'blocker_reason')
