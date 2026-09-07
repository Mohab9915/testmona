"""Add test plan suite scope and test run build

Gives a test plan the suites it intends to execute (plan -> suites -> cases) and
gives a run the build/version it was executed against, so one reusable plan can
be re-run per build instead of cloning its test cases.

Revision ID: add_test_plan_suites_and_run_build
Revises: add_defect_ado_parent
Create Date: 2026-09-07 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

from app.services.migration_helpers import add_column_if_missing, drop_column_if_exists, table_exists


revision = "add_test_plan_suites_and_run_build"
down_revision = "add_defect_ado_parent"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    if not table_exists(connection, "test_plan_suites"):
        op.create_table(
            "test_plan_suites",
            sa.Column("test_plan_id", sa.Integer(), nullable=False),
            sa.Column("test_suite_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["test_plan_id"], ["test_plans.id"]),
            sa.ForeignKeyConstraint(["test_suite_id"], ["test_suites.id"]),
            sa.UniqueConstraint(
                "test_plan_id",
                "test_suite_id",
                name="uq_test_plan_suites_plan_suite",
            ),
        )

    add_column_if_missing(op, "test_runs", sa.Column("build", sa.String(length=100), nullable=True))


def downgrade() -> None:
    connection = op.get_bind()
    drop_column_if_exists(op, "test_runs", "build")
    if table_exists(connection, "test_plan_suites"):
        op.drop_table("test_plan_suites")
