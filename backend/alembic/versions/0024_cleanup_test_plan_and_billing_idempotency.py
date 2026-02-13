"""Remove annual test plan and enforce billing webhook idempotency.

Revision ID: 0024_cleanup_test_plan_and_billing_idempotency
Revises: 0023_add_plus_annual_pix_test_plan
Create Date: 2026-02-13
"""

from __future__ import annotations

from alembic import op


revision = "0024_cleanup_test_plan_and_billing_idempotency"
down_revision = "0023_add_plus_annual_pix_test_plan"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove temporary annual test plan from catalog (keep enum value for compatibility).
    op.execute("DELETE FROM plans WHERE code::text = 'PLUS_ANNUAL_PIX_TEST'")

    # Deduplicate already-recorded repeated webhooks before adding unique index.
    op.execute(
        """
        WITH ranked AS (
          SELECT
            id,
            ROW_NUMBER() OVER (
              PARTITION BY tenant_id, provider, event_type, external_id
              ORDER BY criado_em ASC, id ASC
            ) AS rn
          FROM billing_events
          WHERE external_id IS NOT NULL
        )
        DELETE FROM billing_events b
        USING ranked r
        WHERE b.id = r.id
          AND r.rn > 1
        """
    )

    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS uq_billing_events_event_external
        ON billing_events (tenant_id, provider, event_type, external_id)
        WHERE external_id IS NOT NULL
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_billing_events_event_external")
