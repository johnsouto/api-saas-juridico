"""Process tribunal fields and client cases.

Revision ID: 0019_process_cases_parcerias_fields
Revises: 0018_platform_audit_logs
Create Date: 2026-02-12
"""

from __future__ import annotations

from alembic import op


revision = "0019_process_cases_parcerias_fields"
down_revision = "0018_platform_audit_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE processes ADD COLUMN IF NOT EXISTS tribunal_code VARCHAR(32)")
    op.execute("ALTER TABLE processes ADD COLUMN IF NOT EXISTS tribunal_login_url VARCHAR(500)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_processes_tribunal_code ON processes (tribunal_code)")

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS client_cases (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL,
          client_id UUID NOT NULL,
          title VARCHAR(200),
          content TEXT NOT NULL,
          criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT fk_client_cases_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id),
          CONSTRAINT fk_client_cases_client_id_clients FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_client_cases_tenant_id ON client_cases (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_client_cases_client_id ON client_cases (client_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_client_cases_client_id")
    op.execute("DROP INDEX IF EXISTS ix_client_cases_tenant_id")
    op.execute("DROP TABLE IF EXISTS client_cases")

    op.execute("DROP INDEX IF EXISTS ix_processes_tribunal_code")
    op.execute("ALTER TABLE processes DROP COLUMN IF EXISTS tribunal_login_url")
    op.execute("ALTER TABLE processes DROP COLUMN IF EXISTS tribunal_code")
