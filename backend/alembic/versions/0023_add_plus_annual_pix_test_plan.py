"""Add PLUS_ANNUAL_PIX_TEST plan code and seed test annual plan.

Revision ID: 0023_add_plus_annual_pix_test_plan
Revises: 0022_ensure_billing_events_table
Create Date: 2026-02-13
"""

from __future__ import annotations

import uuid

from alembic import op


revision = "0023_add_plus_annual_pix_test_plan"
down_revision = "0022_ensure_billing_events_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Postgres enum value creation must run outside transaction.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE plan_code ADD VALUE IF NOT EXISTS 'PLUS_ANNUAL_PIX_TEST'")

    test_plan_id = str(uuid.uuid4())
    op.execute(
        f"""
        INSERT INTO plans (id, criado_em, atualizado_em, code, nome, max_users, max_storage_mb, price, price_cents, currency, billing_period)
        SELECT '{test_plan_id}'::uuid, NOW(), NOW(),
               'PLUS_ANNUAL_PIX_TEST', 'Plus Anual (Pix) - Teste',
               30, 8000,
               5.00, 500, 'BRL', 'YEARLY'
        WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'PLUS_ANNUAL_PIX_TEST');
        """
    )

    op.execute(
        """
        UPDATE plans
        SET price = 5.00,
            price_cents = 500,
            currency = 'BRL',
            billing_period = 'YEARLY',
            max_users = 30,
            max_clients = NULL,
            max_storage_mb = 8000,
            atualizado_em = NOW()
        WHERE code = 'PLUS_ANNUAL_PIX_TEST'
        """
    )


def downgrade() -> None:
    # Keep historical enum values in place; only remove seeded plan row.
    op.execute("DELETE FROM plans WHERE code = 'PLUS_ANNUAL_PIX_TEST'")
