"""Fix legacy subscriptions.plan_id (rebuild v2 table).

Some production databases ended up with Alembic stamped at 0008/0009 while the legacy
`subscriptions` table (with NOT NULL `plan_id`) was still present. The application now
expects the Billing v2 schema (plan_code/provider/current_period_*), so we rebuild
`subscriptions` when we detect the legacy shape.

Revision ID: 0010_fix_subscriptions_plan_id_legacy
Revises: 0009_fix_plan_code_enum_and_plans_seed
Create Date: 2026-02-09
"""

from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0010_fix_subscriptions_plan_id_legacy"
down_revision = "0009_fix_plan_code_enum_and_plans_seed"
branch_labels = None
depends_on = None


def _has_column(bind: sa.engine.Connection, *, table: str, column: str) -> bool:
    row = bind.execute(
        sa.text(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = :table
              AND column_name = :column
            LIMIT 1
            """
        ),
        {"table": table, "column": column},
    ).fetchone()
    return row is not None


def upgrade() -> None:
    bind = op.get_bind()

    # If we already have the v2 schema, nothing to do.
    if not _has_column(bind, table="subscriptions", column="plan_id"):
        return

    # Rename the legacy table to subscriptions_old and avoid constraint name collisions.
    # (Constraint/index names must be unique within the schema.)
    op.execute(
        """
        DO $$
        BEGIN
          -- If a previous attempt left a `subscriptions_old`, keep it as a legacy backup.
          IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'subscriptions_old'
          ) THEN
            -- Keep only one backup to avoid unbounded clutter.
            IF EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'subscriptions_old_legacy'
            ) THEN
              DROP TABLE subscriptions_old_legacy;
            END IF;
            ALTER TABLE subscriptions_old RENAME TO subscriptions_old_legacy;
          END IF;

          ALTER TABLE subscriptions RENAME TO subscriptions_old;

          -- Best-effort: rename legacy constraints if they still exist.
          IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pk_subscriptions') THEN
            EXECUTE 'ALTER TABLE subscriptions_old RENAME CONSTRAINT pk_subscriptions TO pk_subscriptions_old';
          END IF;
          IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscriptions_tenant_id_tenants') THEN
            EXECUTE 'ALTER TABLE subscriptions_old RENAME CONSTRAINT fk_subscriptions_tenant_id_tenants TO fk_subscriptions_old_tenant_id_tenants';
          END IF;
          IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_subscriptions_plan_id_plans') THEN
            EXECUTE 'ALTER TABLE subscriptions_old RENAME CONSTRAINT fk_subscriptions_plan_id_plans TO fk_subscriptions_old_plan_id_plans';
          END IF;
        END $$;
        """
    )

    # Recreate subscriptions with the Billing v2 schema.
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

    # Best-effort migration from the legacy table (take the latest row per tenant).
    # NOTE: legacy `status` is an enum; we keep it for last_payment_status and map trialing -> active.
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
          COALESCE(p.code, 'FREE')::plan_code AS plan_code,
          CASE
            WHEN COALESCE(p.code, 'FREE')::text = 'FREE' THEN 'free'::subscription_status
            WHEN s.status::text = 'trialing' THEN 'active'::subscription_status
            ELSE s.status
          END AS status,
          CASE
            WHEN s.stripe_id IS NOT NULL THEN 'STRIPE'::billing_provider
            ELSE 'FAKE'::billing_provider
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

    # Drop the legacy table to prevent future confusion. (We keep `subscriptions_old_legacy` if it existed.)
    op.execute("DROP TABLE IF EXISTS subscriptions_old")


def downgrade() -> None:
    # Hotfix migration: no downgrade.
    pass

