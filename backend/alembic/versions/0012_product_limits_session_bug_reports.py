"""Product limits + session policy + bug reports.

Revision ID: 0012_product_limits_session_bug_reports
Revises: 0011_user_name_parts
Create Date: 2026-02-10
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0012_product_limits_session_bug_reports"
down_revision = "0011_user_name_parts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Plans: add max_clients (FREE = 3, PLUS = unlimited/NULL)
    op.execute("ALTER TABLE plans ADD COLUMN IF NOT EXISTS max_clients INTEGER")
    op.execute("UPDATE plans SET max_clients = 3 WHERE code = 'FREE' AND max_clients IS NULL")
    op.execute("UPDATE plans SET max_clients = NULL WHERE code IN ('PLUS_MONTHLY_CARD', 'PLUS_ANNUAL_PIX')")

    # Users: last_activity_at to enforce idle timeouts for refresh tokens.
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ")
    op.execute("UPDATE users SET last_activity_at = NOW() WHERE last_activity_at IS NULL")

    # Bug reports (user feedback)
    op.create_table(
        "bug_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("NOW()")),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
    )
    op.create_index("ix_bug_reports_tenant_id", "bug_reports", ["tenant_id"])
    op.create_index("ix_bug_reports_user_id", "bug_reports", ["user_id"])
    op.create_index("ix_bug_reports_criado_em", "bug_reports", ["criado_em"])


def downgrade() -> None:
    # Best-effort rollback.
    op.drop_index("ix_bug_reports_criado_em", table_name="bug_reports")
    op.drop_index("ix_bug_reports_user_id", table_name="bug_reports")
    op.drop_index("ix_bug_reports_tenant_id", table_name="bug_reports")
    op.drop_table("bug_reports")

    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS last_activity_at")
    op.execute("ALTER TABLE plans DROP COLUMN IF EXISTS max_clients")

