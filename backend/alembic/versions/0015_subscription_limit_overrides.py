"""Subscription per-tenant limit overrides.

Revision ID: 0015_subscription_limit_overrides
Revises: 0014_client_soft_delete
Create Date: 2026-02-11
"""

from __future__ import annotations

from alembic import op


revision = "0015_subscription_limit_overrides"
down_revision = "0014_client_soft_delete"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Optional overrides set by platform admin to customize limits per tenant (ex: "Free, but bigger quota").
    op.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS max_clients_override INTEGER")
    op.execute("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS max_storage_mb_override INTEGER")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_subscriptions_tenant_id_overrides "
        "ON subscriptions (tenant_id, max_clients_override, max_storage_mb_override)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_subscriptions_tenant_id_overrides")
    op.execute("ALTER TABLE subscriptions DROP COLUMN IF EXISTS max_storage_mb_override")
    op.execute("ALTER TABLE subscriptions DROP COLUMN IF EXISTS max_clients_override")

