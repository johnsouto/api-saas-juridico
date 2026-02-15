"""Account delete flow, tenant exports and audit fields.

Revision ID: 0025_account_delete_exports_audit_hardening
Revises: 0024_cleanup_test_plan_and_billing_idempotency
Create Date: 2026-02-15
"""

from __future__ import annotations

from alembic import op


revision = "0025_account_delete_exports_audit_hardening"
down_revision = "0024_cleanup_test_plan_and_billing_idempotency"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # subscriptions: cancellation metadata + manual refund triage state.
    op.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ")
    op.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS refund_status VARCHAR(40)")
    op.execute("UPDATE subscriptions SET refund_status = 'NONE' WHERE refund_status IS NULL")
    op.execute("ALTER TABLE subscriptions ALTER COLUMN refund_status SET DEFAULT 'NONE'")
    op.execute("ALTER TABLE subscriptions ALTER COLUMN refund_status SET NOT NULL")

    # tenants: pending-delete lifecycle fields (LGPD-safe, no immediate hard delete).
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status VARCHAR(40)")
    op.execute("UPDATE tenants SET status = 'ACTIVE' WHERE status IS NULL")
    op.execute("ALTER TABLE tenants ALTER COLUMN status SET DEFAULT 'ACTIVE'")
    op.execute("ALTER TABLE tenants ALTER COLUMN status SET NOT NULL")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tenants_status ON tenants (status)")

    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS delete_requested_at TIMESTAMPTZ")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS delete_scheduled_for TIMESTAMPTZ")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS delete_reason_code VARCHAR(40)")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS delete_reason_text VARCHAR(1000)")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS delete_access_until TIMESTAMPTZ")

    # audit_logs: richer actor/request context for critical flows.
    op.execute("ALTER TABLE audit_logs ALTER COLUMN action TYPE VARCHAR(120)")
    op.execute("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)")
    op.execute("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip VARCHAR(64)")
    op.execute("ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent VARCHAR(500)")
    op.execute('ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "metadata" JSONB')
    op.execute("CREATE INDEX IF NOT EXISTS ix_audit_logs_user_id ON audit_logs (user_id)")

    # tenant exports (async job + download window).
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tenant_exports (
          id UUID PRIMARY KEY,
          criado_em TIMESTAMPTZ NOT NULL,
          atualizado_em TIMESTAMPTZ NOT NULL,
          tenant_id UUID NOT NULL REFERENCES tenants(id),
          requested_by_user_id UUID NOT NULL REFERENCES users(id),
          status VARCHAR(20) NOT NULL,
          started_at TIMESTAMPTZ NULL,
          finished_at TIMESTAMPTZ NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          file_key VARCHAR(1024) NULL,
          file_size_bytes BIGINT NULL,
          error_message TEXT NULL,
          downloaded_at TIMESTAMPTZ NULL,
          email_sent_at TIMESTAMPTZ NULL,
          email_confirm_token VARCHAR(120) NOT NULL,
          email_confirmed_at TIMESTAMPTZ NULL,
          email_confirmed_ip VARCHAR(64) NULL,
          note VARCHAR(200) NULL
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_tenant_exports_tenant_id ON tenant_exports (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tenant_exports_requested_by_user_id ON tenant_exports (requested_by_user_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tenant_exports_status ON tenant_exports (status)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tenant_exports_expires_at ON tenant_exports (expires_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tenant_exports_created_tenant ON tenant_exports (tenant_id, criado_em DESC)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_tenant_exports_created_tenant")
    op.execute("DROP INDEX IF EXISTS ix_tenant_exports_expires_at")
    op.execute("DROP INDEX IF EXISTS ix_tenant_exports_status")
    op.execute("DROP INDEX IF EXISTS ix_tenant_exports_requested_by_user_id")
    op.execute("DROP INDEX IF EXISTS ix_tenant_exports_tenant_id")
    op.execute("DROP TABLE IF EXISTS tenant_exports")

    op.execute("DROP INDEX IF EXISTS ix_audit_logs_user_id")
    op.execute('ALTER TABLE audit_logs DROP COLUMN IF EXISTS "metadata"')
    op.execute("ALTER TABLE audit_logs DROP COLUMN IF EXISTS user_agent")
    op.execute("ALTER TABLE audit_logs DROP COLUMN IF EXISTS ip")
    op.execute("ALTER TABLE audit_logs DROP COLUMN IF EXISTS user_id")
    op.execute("ALTER TABLE audit_logs ALTER COLUMN action TYPE VARCHAR(20)")

    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS delete_access_until")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS delete_reason_text")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS delete_reason_code")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS delete_scheduled_for")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS delete_requested_at")
    op.execute("DROP INDEX IF EXISTS ix_tenants_status")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS status")

    op.execute("ALTER TABLE subscriptions DROP COLUMN IF EXISTS refund_status")
    op.execute("ALTER TABLE subscriptions DROP COLUMN IF EXISTS cancellation_requested_at")
