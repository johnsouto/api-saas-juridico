"""billing v2 (plans/subscriptions/events)

Revision ID: 0008_billing_v2
Revises: 0007_honorarios_client_process_optional
Create Date: 2026-02-08
"""

from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0008_billing_v2"
down_revision = "0007_honorarios_client_process_optional"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1) New enums
    postgresql.ENUM("FREE", "PLUS_MONTHLY_CARD", "PLUS_ANNUAL_PIX", name="plan_code").create(bind, checkfirst=True)
    postgresql.ENUM("NONE", "MONTHLY", "YEARLY", name="billing_period").create(bind, checkfirst=True)
    postgresql.ENUM("FAKE", "STRIPE", "MERCADOPAGO", name="billing_provider").create(bind, checkfirst=True)

    # 2) Extend legacy subscription_status enum (idempotent).
    # Postgres does not allow ALTER TYPE ... ADD VALUE inside a transaction.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'free'")
        op.execute("ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'expired'")

    # 3) Plans: add required billing fields + backfill
    op.execute("ALTER TABLE plans ADD COLUMN IF NOT EXISTS code plan_code")
    op.execute("ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE plans ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'BRL'")
    op.execute("ALTER TABLE plans ADD COLUMN IF NOT EXISTS billing_period billing_period NOT NULL DEFAULT 'NONE'")

    # Backfill existing rows (Free/Pro from seed).
    op.execute(
        """
        UPDATE plans
        SET code = 'FREE',
            price = 0.00,
            price_cents = 0,
            currency = 'BRL',
            billing_period = 'NONE'
        WHERE code IS NULL
          AND (nome ILIKE 'free%' OR nome ILIKE '%free%')
        """
    )
    op.execute(
        """
        UPDATE plans
        SET code = 'PLUS_MONTHLY_CARD',
            price = 47.00,
            price_cents = 4700,
            currency = 'BRL',
            billing_period = 'MONTHLY'
        WHERE code IS NULL
          AND (nome ILIKE 'pro%' OR nome ILIKE '%pro%')
        """
    )
    # Any remaining legacy rows fall back to FREE.
    op.execute(
        """
        UPDATE plans
        SET code = 'FREE',
            price = 0.00,
            price_cents = 0,
            currency = 'BRL',
            billing_period = 'NONE'
        WHERE code IS NULL
        """
    )

    # Enforce NOT NULL after backfill.
    op.execute("ALTER TABLE plans ALTER COLUMN code SET NOT NULL")

    # Ensure yearly PIX plan exists.
    annual_id = str(uuid.uuid4())
    op.execute(
        f"""
        INSERT INTO plans (id, criado_em, atualizado_em, code, nome, max_users, max_storage_mb, price, price_cents, currency, billing_period)
        SELECT '{annual_id}'::uuid, NOW(), NOW(),
               'PLUS_ANNUAL_PIX', 'Plus Anual (Pix)',
               30, 8000,
               499.00, 49900, 'BRL', 'YEARLY'
        WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'PLUS_ANNUAL_PIX')
        """
    )

    # Unique index for plan code.
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_plans_code ON plans (code)")

    # 4) Subscriptions: rebuild as 1 row per tenant with v2 columns.
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'subscriptions'
          )
          AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'subscriptions_old'
          ) THEN
            ALTER TABLE subscriptions RENAME TO subscriptions_old;
          END IF;
        END $$;
        """
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("plan_code", postgresql.ENUM(name="plan_code", create_type=False), nullable=False),
        sa.Column("status", postgresql.ENUM(name="subscription_status", create_type=False), nullable=False),
        sa.Column("provider", postgresql.ENUM(name="billing_provider", create_type=False), nullable=False),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("grace_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("last_payment_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_payment_status", sa.String(length=50), nullable=True),
        sa.Column("provider_customer_id", sa.String(length=120), nullable=True),
        sa.Column("provider_subscription_id", sa.String(length=120), nullable=True),
        sa.Column("provider_payment_id", sa.String(length=120), nullable=True),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["plan_code"], ["plans.code"]),
        sa.UniqueConstraint("tenant_id"),
    )
    op.create_index("ix_subscriptions_status", "subscriptions", ["status"])
    op.create_index("ix_subscriptions_plan_code", "subscriptions", ["plan_code"])
    op.create_index("ix_subscriptions_provider_subscription_id", "subscriptions", ["provider_subscription_id"])
    op.create_index("ix_subscriptions_provider_payment_id", "subscriptions", ["provider_payment_id"])

    # Migrate data from old subscriptions (best-effort: latest row per tenant).
    op.execute(
        """
        INSERT INTO subscriptions (
          id, criado_em, atualizado_em,
          tenant_id,
          plan_code,
          status,
          provider,
          current_period_start,
          current_period_end,
          grace_period_end,
          cancel_at_period_end,
          last_payment_at,
          last_payment_status,
          provider_customer_id,
          provider_subscription_id,
          provider_payment_id
        )
        SELECT DISTINCT ON (s.tenant_id)
          s.id, s.criado_em, s.atualizado_em,
          s.tenant_id,
          COALESCE(p.code, 'FREE') AS plan_code,
          CASE
            WHEN COALESCE(p.code, 'FREE') = 'FREE' THEN 'free'
            WHEN s.status = 'trialing' THEN 'active'
            ELSE s.status
          END AS status,
          CASE
            WHEN s.stripe_id IS NOT NULL THEN 'STRIPE'
            ELSE 'FAKE'
          END AS provider,
          s.criado_em AS current_period_start,
          s.validade AS current_period_end,
          NULL AS grace_period_end,
          false AS cancel_at_period_end,
          s.atualizado_em AS last_payment_at,
          s.status::text AS last_payment_status,
          NULL AS provider_customer_id,
          s.stripe_id AS provider_subscription_id,
          NULL AS provider_payment_id
        FROM subscriptions_old s
        LEFT JOIN plans p ON p.id = s.plan_id
        ORDER BY s.tenant_id, s.criado_em DESC
        ON CONFLICT (tenant_id) DO NOTHING
        """
    )

    # Ensure every tenant has a subscription row (default FREE).
    missing = bind.execute(sa.text("SELECT id FROM tenants WHERE id NOT IN (SELECT tenant_id FROM subscriptions)")).fetchall()
    for (tenant_id,) in missing:
        bind.execute(
            sa.text(
                """
                INSERT INTO subscriptions (id, criado_em, atualizado_em, tenant_id, plan_code, status, provider, cancel_at_period_end)
                VALUES (:id, NOW(), NOW(), :tenant_id, 'FREE', 'free', 'FAKE', false)
                """
            ),
            {"id": str(uuid.uuid4()), "tenant_id": str(tenant_id)},
        )

    # Drop legacy table.
    op.execute("DROP TABLE IF EXISTS subscriptions_old")

    # 5) Billing events (debug/audit)
    op.create_table(
        "billing_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), nullable=False),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("event_type", sa.String(length=60), nullable=False),
        sa.Column("external_id", sa.String(length=200), nullable=True),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
    )
    op.create_index("ix_billing_events_tenant_id", "billing_events", ["tenant_id"])


def downgrade() -> None:
    # Best-effort: keep enums (shared). Remove tables/columns.
    op.drop_table("billing_events")

    op.drop_table("subscriptions")

    op.execute("ALTER TABLE plans DROP COLUMN IF EXISTS billing_period")
    op.execute("ALTER TABLE plans DROP COLUMN IF EXISTS currency")
    op.execute("ALTER TABLE plans DROP COLUMN IF EXISTS price_cents")
    op.execute("ALTER TABLE plans DROP COLUMN IF EXISTS code")
