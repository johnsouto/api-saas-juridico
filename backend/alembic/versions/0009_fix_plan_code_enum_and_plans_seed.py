"""Fix plan_code enum + ensure plans seeded (prod hotfix).

Revision ID: 0009_fix_plan_code_enum_and_plans_seed
Revises: 0008_billing_v2
Create Date: 2026-02-09
"""

from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "0009_fix_plan_code_enum_and_plans_seed"
down_revision = "0008_billing_v2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    # Ensure enum types exist (best-effort: DBs may have been stamped incorrectly).
    postgresql.ENUM("FREE", "PLUS_MONTHLY_CARD", "PLUS_ANNUAL_PIX", name="plan_code").create(bind, checkfirst=True)
    postgresql.ENUM("NONE", "MONTHLY", "YEARLY", name="billing_period").create(bind, checkfirst=True)
    postgresql.ENUM("FAKE", "STRIPE", "MERCADOPAGO", name="billing_provider").create(bind, checkfirst=True)
    postgresql.ENUM("free", "active", "canceled", "past_due", "trialing", "expired", name="subscription_status").create(
        bind, checkfirst=True
    )

    # Add missing enum values idempotently.
    # Postgres does not allow ALTER TYPE ... ADD VALUE inside a transaction.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE plan_code ADD VALUE IF NOT EXISTS 'FREE'")
        op.execute("ALTER TYPE plan_code ADD VALUE IF NOT EXISTS 'PLUS_MONTHLY_CARD'")
        op.execute("ALTER TYPE plan_code ADD VALUE IF NOT EXISTS 'PLUS_ANNUAL_PIX'")

        op.execute("ALTER TYPE billing_period ADD VALUE IF NOT EXISTS 'NONE'")
        op.execute("ALTER TYPE billing_period ADD VALUE IF NOT EXISTS 'MONTHLY'")
        op.execute("ALTER TYPE billing_period ADD VALUE IF NOT EXISTS 'YEARLY'")

        op.execute("ALTER TYPE billing_provider ADD VALUE IF NOT EXISTS 'FAKE'")
        op.execute("ALTER TYPE billing_provider ADD VALUE IF NOT EXISTS 'STRIPE'")
        op.execute("ALTER TYPE billing_provider ADD VALUE IF NOT EXISTS 'MERCADOPAGO'")

        op.execute("ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'free'")
        op.execute("ALTER TYPE subscription_status ADD VALUE IF NOT EXISTS 'expired'")

    # Ensure required plan columns exist (safe if 0008 was stamped but not executed).
    op.execute("ALTER TABLE plans ADD COLUMN IF NOT EXISTS code plan_code")
    op.execute("ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE plans ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'BRL'")
    op.execute("ALTER TABLE plans ADD COLUMN IF NOT EXISTS billing_period billing_period NOT NULL DEFAULT 'NONE'")

    # Backfill / normalize code values before enforcing constraints/casting.
    op.execute("UPDATE plans SET code = 'FREE' WHERE code IS NULL OR btrim(code::text) = ''")
    op.execute("UPDATE plans SET code = 'FREE' WHERE lower(code::text) = 'free'")
    op.execute("UPDATE plans SET code = 'PLUS_MONTHLY_CARD' WHERE lower(code::text) IN ('pro', 'plus_monthly_card')")
    op.execute("UPDATE plans SET code = 'PLUS_ANNUAL_PIX' WHERE lower(code::text) = 'plus_annual_pix'")

    # Legacy name-based normalization (helps DBs created in early demos).
    op.execute("UPDATE plans SET code = 'FREE' WHERE (nome ILIKE 'free%' OR nome ILIKE '%free%')")
    op.execute("UPDATE plans SET code = 'PLUS_MONTHLY_CARD' WHERE (nome ILIKE 'pro%' OR nome ILIKE '%pro%')")
    op.execute("UPDATE plans SET code = 'PLUS_ANNUAL_PIX' WHERE (nome ILIKE '%anual%' OR nome ILIKE '%pix%')")

    op.execute(
        """
        UPDATE plans
        SET code = 'FREE'
        WHERE code::text NOT IN ('FREE', 'PLUS_MONTHLY_CARD', 'PLUS_ANNUAL_PIX')
        """
    )

    # Ensure `plans.code` uses the enum type `plan_code`.
    op.execute(
        """
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'plans'
              AND column_name = 'code'
              AND udt_name <> 'plan_code'
          ) THEN
            ALTER TABLE plans
            ALTER COLUMN code TYPE plan_code
            USING code::plan_code;
          END IF;
        END $$;
        """
    )

    # Deduplicate plan rows by code (important before creating the unique index).
    # We reuse the same strategy as 0008: repoint legacy subscriptions.plan_id if present, then delete duplicates.
    op.execute(
        """
        DO $$
        BEGIN
          -- Update legacy subscriptions table if present.
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'plan_id'
          ) THEN
            WITH ranked AS (
              SELECT
                id,
                code,
                ROW_NUMBER() OVER (
                  PARTITION BY code
                  ORDER BY atualizado_em DESC
                ) AS rn
              FROM plans
            ),
            winners AS (
              SELECT code, id AS winner_id
              FROM ranked
              WHERE rn = 1
            ),
            losers AS (
              SELECT id AS loser_id, code
              FROM ranked
              WHERE rn > 1
            ),
            map AS (
              SELECT losers.loser_id, winners.winner_id
              FROM losers
              JOIN winners USING (code)
            )
            UPDATE subscriptions s
            SET plan_id = map.winner_id
            FROM map
            WHERE s.plan_id = map.loser_id;
          END IF;

          -- Update subscriptions_old if present (best-effort).
          IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'subscriptions_old' AND column_name = 'plan_id'
          ) THEN
            WITH ranked AS (
              SELECT
                id,
                code,
                ROW_NUMBER() OVER (
                  PARTITION BY code
                  ORDER BY atualizado_em DESC
                ) AS rn
              FROM plans
            ),
            winners AS (
              SELECT code, id AS winner_id
              FROM ranked
              WHERE rn = 1
            ),
            losers AS (
              SELECT id AS loser_id, code
              FROM ranked
              WHERE rn > 1
            ),
            map AS (
              SELECT losers.loser_id, winners.winner_id
              FROM losers
              JOIN winners USING (code)
            )
            UPDATE subscriptions_old s
            SET plan_id = map.winner_id
            FROM map
            WHERE s.plan_id = map.loser_id;
          END IF;

          -- Now remove duplicate plan rows.
          WITH ranked AS (
            SELECT
              id,
              code,
              ROW_NUMBER() OVER (
                PARTITION BY code
                ORDER BY atualizado_em DESC
              ) AS rn
            FROM plans
          )
          DELETE FROM plans p
          USING ranked r
          WHERE p.id = r.id
            AND r.rn > 1;
        END $$;
        """
    )

    # Enforce NOT NULL + unique code.
    op.execute("ALTER TABLE plans ALTER COLUMN code SET NOT NULL")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_plans_code ON plans (code)")

    # Ensure the 3 canonical plans exist (by code).
    free_id = str(uuid.uuid4())
    op.execute(
        f"""
        INSERT INTO plans (id, criado_em, atualizado_em, code, nome, max_users, max_storage_mb, price, price_cents, currency, billing_period)
        SELECT '{free_id}'::uuid, NOW(), NOW(),
               'FREE', 'Free',
               3, 100,
               0.00, 0, 'BRL', 'NONE'
        WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'FREE');
        """
    )

    monthly_id = str(uuid.uuid4())
    op.execute(
        f"""
        INSERT INTO plans (id, criado_em, atualizado_em, code, nome, max_users, max_storage_mb, price, price_cents, currency, billing_period)
        SELECT '{monthly_id}'::uuid, NOW(), NOW(),
               'PLUS_MONTHLY_CARD', 'Plus Mensal (Cartão)',
               20, 5000,
               47.00, 4700, 'BRL', 'MONTHLY'
        WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'PLUS_MONTHLY_CARD');
        """
    )

    annual_id = str(uuid.uuid4())
    op.execute(
        f"""
        INSERT INTO plans (id, criado_em, atualizado_em, code, nome, max_users, max_storage_mb, price, price_cents, currency, billing_period)
        SELECT '{annual_id}'::uuid, NOW(), NOW(),
               'PLUS_ANNUAL_PIX', 'Plus Anual (Pix)',
               30, 8000,
               499.00, 49900, 'BRL', 'YEARLY'
        WHERE NOT EXISTS (SELECT 1 FROM plans WHERE code = 'PLUS_ANNUAL_PIX');
        """
    )

    # Normalize pricing/limits (do not force `nome`, to avoid unique(nome) collisions in older DBs).
    op.execute(
        """
        UPDATE plans
        SET price = 0.00,
            price_cents = 0,
            currency = 'BRL',
            billing_period = 'NONE',
            max_users = 3,
            max_storage_mb = 100,
            atualizado_em = NOW()
        WHERE code = 'FREE'
        """
    )
    op.execute(
        """
        UPDATE plans
        SET price = 47.00,
            price_cents = 4700,
            currency = 'BRL',
            billing_period = 'MONTHLY',
            max_users = 20,
            max_storage_mb = 5000,
            atualizado_em = NOW()
        WHERE code = 'PLUS_MONTHLY_CARD'
        """
    )
    op.execute(
        """
        UPDATE plans
        SET price = 499.00,
            price_cents = 49900,
            currency = 'BRL',
            billing_period = 'YEARLY',
            max_users = 30,
            max_storage_mb = 8000,
            atualizado_em = NOW()
        WHERE code = 'PLUS_ANNUAL_PIX'
        """
    )


def downgrade() -> None:
    # No-op (hotfix migration). We intentionally keep enums and data.
    pass

