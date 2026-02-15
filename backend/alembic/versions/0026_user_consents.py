"""Add user_consents table for legal/marketing consent history.

Revision ID: 0026_user_consents
Revises: 0025_account_delete_exports_audit_hardening
Create Date: 2026-02-15
"""

from __future__ import annotations

from alembic import op


revision = "0026_user_consents"
down_revision = "0025_account_delete_exports_audit_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS user_consents (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id),
          tenant_id UUID NOT NULL REFERENCES tenants(id),
          accept_terms BOOLEAN NOT NULL,
          marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
          terms_version VARCHAR(40) NOT NULL,
          privacy_version VARCHAR(40) NOT NULL,
          consent_source VARCHAR(80) NOT NULL,
          ip_address VARCHAR(64) NULL,
          user_agent VARCHAR(500) NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_consents_user_id ON user_consents (user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_consents_tenant_id ON user_consents (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_consents_created_at ON user_consents (created_at)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_user_consents_created_at")
    op.execute("DROP INDEX IF EXISTS ix_user_consents_tenant_id")
    op.execute("DROP INDEX IF EXISTS ix_user_consents_user_id")
    op.execute("DROP TABLE IF EXISTS user_consents")
