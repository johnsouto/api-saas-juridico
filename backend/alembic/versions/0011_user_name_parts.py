"""Add users.first_name/last_name (split name support).

Revision ID: 0011_user_name_parts
Revises: 0010_fix_subscriptions_plan_id_legacy
Create Date: 2026-02-10
"""

from __future__ import annotations

from alembic import op


revision = "0011_user_name_parts"
down_revision = "0010_fix_subscriptions_plan_id_legacy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nullable for backward compatibility with existing databases.
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name VARCHAR(200)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name VARCHAR(200)")

    # Best-effort backfill:
    # - Preserve composed names by copying the legacy `nome` into `first_name`.
    # - We intentionally do not try to infer `last_name` to avoid incorrect splits.
    op.execute("UPDATE users SET first_name = nome WHERE first_name IS NULL OR btrim(first_name) = ''")


def downgrade() -> None:
    # Best-effort only.
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS first_name")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS last_name")

