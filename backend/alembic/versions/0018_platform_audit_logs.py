"""Create platform audit logs table.

Revision ID: 0018_platform_audit_logs
Revises: 0017_document_categoria_options
Create Date: 2026-02-12
"""

from __future__ import annotations

from alembic import op


revision = "0018_platform_audit_logs"
down_revision = "0017_document_categoria_options"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS platform_audit_logs (
          id UUID PRIMARY KEY,
          action VARCHAR(120) NOT NULL,
          tenant_id UUID NULL,
          payload JSONB NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT fk_platform_audit_logs_tenant_id_tenants
            FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_platform_audit_logs_action ON platform_audit_logs (action)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_platform_audit_logs_tenant_id ON platform_audit_logs (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_platform_audit_logs_created_at ON platform_audit_logs (created_at)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_platform_audit_logs_created_at")
    op.execute("DROP INDEX IF EXISTS ix_platform_audit_logs_tenant_id")
    op.execute("DROP INDEX IF EXISTS ix_platform_audit_logs_action")
    op.execute("DROP TABLE IF EXISTS platform_audit_logs")
