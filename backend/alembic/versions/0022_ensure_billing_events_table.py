"""Ensure billing_events table exists.

Some environments were upgraded with Billing v2 partially applied, ending up
without `billing_events`. This migration is an idempotent safety-net.

Revision ID: 0022_ensure_billing_events_table
Revises: 0021_client_partnerships
Create Date: 2026-02-13
"""

from __future__ import annotations

from alembic import op


revision = "0022_ensure_billing_events_table"
down_revision = "0021_client_partnerships"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS billing_events (
          id UUID PRIMARY KEY,
          criado_em TIMESTAMPTZ NOT NULL,
          atualizado_em TIMESTAMPTZ NOT NULL,
          tenant_id UUID NOT NULL,
          provider VARCHAR(20) NOT NULL,
          event_type VARCHAR(60) NOT NULL,
          external_id VARCHAR(200),
          payload_json JSONB NOT NULL,
          CONSTRAINT fk_billing_events_tenant_id_tenants
            FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_billing_events_tenant_id ON billing_events (tenant_id)")


def downgrade() -> None:
    # Safety migration: keep table/data on downgrade.
    pass
