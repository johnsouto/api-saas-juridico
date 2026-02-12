"""Partnership OAB UF and optional address fields.

Revision ID: 0020_parcerias_oab_endereco
Revises: 0019_process_cases_parcerias_fields
Create Date: 2026-02-12
"""

from __future__ import annotations

from alembic import op


revision = "0020_parcerias_oab_endereco"
down_revision = "0019_process_cases_parcerias_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE parcerias ADD COLUMN IF NOT EXISTS oab_uf VARCHAR(2)")
    op.execute("ALTER TABLE parcerias ADD COLUMN IF NOT EXISTS address_street VARCHAR(200)")
    op.execute("ALTER TABLE parcerias ADD COLUMN IF NOT EXISTS address_number VARCHAR(40)")
    op.execute("ALTER TABLE parcerias ADD COLUMN IF NOT EXISTS address_complement VARCHAR(200)")
    op.execute("ALTER TABLE parcerias ADD COLUMN IF NOT EXISTS address_neighborhood VARCHAR(120)")
    op.execute("ALTER TABLE parcerias ADD COLUMN IF NOT EXISTS address_city VARCHAR(120)")
    op.execute("ALTER TABLE parcerias ADD COLUMN IF NOT EXISTS address_state VARCHAR(2)")
    op.execute("ALTER TABLE parcerias ADD COLUMN IF NOT EXISTS address_zip VARCHAR(16)")


def downgrade() -> None:
    op.execute("ALTER TABLE parcerias DROP COLUMN IF EXISTS address_zip")
    op.execute("ALTER TABLE parcerias DROP COLUMN IF EXISTS address_state")
    op.execute("ALTER TABLE parcerias DROP COLUMN IF EXISTS address_city")
    op.execute("ALTER TABLE parcerias DROP COLUMN IF EXISTS address_neighborhood")
    op.execute("ALTER TABLE parcerias DROP COLUMN IF EXISTS address_complement")
    op.execute("ALTER TABLE parcerias DROP COLUMN IF EXISTS address_number")
    op.execute("ALTER TABLE parcerias DROP COLUMN IF EXISTS address_street")
    op.execute("ALTER TABLE parcerias DROP COLUMN IF EXISTS oab_uf")
