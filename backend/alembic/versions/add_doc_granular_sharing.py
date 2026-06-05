"""Add granular Doc Hub sharing: per-grant share grants + share audit trail

Revision ID: add_doc_granular_sharing
Revises: add_doc_release_notes
Create Date: 2026-06-05 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

from app.services.migration_helpers import table_exists


revision = "add_doc_granular_sharing"
down_revision = "add_doc_release_notes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()

    if not table_exists(connection, "doc_share_grants"):
        op.create_table(
            "doc_share_grants",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("doc_id", sa.Integer(), nullable=False),
            sa.Column("grant_type", sa.String(length=20), nullable=False),
            sa.Column("subject_user_id", sa.Integer(), nullable=True),
            sa.Column("subject_role", sa.String(length=20), nullable=True),
            sa.Column("subject_project_id", sa.Integer(), nullable=True),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["doc_id"], ["docs.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["subject_user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["subject_project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "doc_id", "grant_type", "subject_user_id", "subject_role", "subject_project_id",
                name="uq_doc_share_grant",
            ),
        )
        op.create_index("ix_doc_share_grants_doc_id", "doc_share_grants", ["doc_id"])

    if not table_exists(connection, "doc_share_audits"):
        op.create_table(
            "doc_share_audits",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("doc_id", sa.Integer(), nullable=False),
            sa.Column("actor_id", sa.Integer(), nullable=True),
            sa.Column("action", sa.String(length=40), nullable=False),
            sa.Column("detail", sa.String(length=500), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.ForeignKeyConstraint(["doc_id"], ["docs.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_doc_share_audits_doc_id", "doc_share_audits", ["doc_id"])
        op.create_index("ix_doc_share_audits_created_at", "doc_share_audits", ["created_at"])


def downgrade() -> None:
    connection = op.get_bind()
    if table_exists(connection, "doc_share_audits"):
        op.drop_index("ix_doc_share_audits_created_at", table_name="doc_share_audits")
        op.drop_index("ix_doc_share_audits_doc_id", table_name="doc_share_audits")
        op.drop_table("doc_share_audits")
    if table_exists(connection, "doc_share_grants"):
        op.drop_index("ix_doc_share_grants_doc_id", table_name="doc_share_grants")
        op.drop_table("doc_share_grants")
