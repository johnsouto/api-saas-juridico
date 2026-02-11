"""Profile + Client fields + Parcerias OAB.

Revision ID: 0013_profile_clients_parcerias_fields
Revises: 0012_product_limits_session_bug_reports
Create Date: 2026-02-10
"""

from __future__ import annotations

from alembic import op


revision = "0013_profile_clients_parcerias_fields"
down_revision = "0012_product_limits_session_bug_reports"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ---- users: OAB number
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS oab_number VARCHAR(40)")

    # ---- tenants: address fields (law firm)
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_street VARCHAR(200)")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_number VARCHAR(40)")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_complement VARCHAR(200)")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_neighborhood VARCHAR(120)")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_city VARCHAR(120)")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_state VARCHAR(2)")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS address_zip VARCHAR(16)")

    # ---- parcerias: OAB number
    op.execute("ALTER TABLE parcerias ADD COLUMN IF NOT EXISTS oab_number VARCHAR(40)")

    # ---- clients: migrate from cpf -> documento + add type + contact + address
    # Ensure enum exists (older DBs might be missing it).
    op.execute(
        """
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_documento_tipo') THEN
    CREATE TYPE tenant_documento_tipo AS ENUM ('cpf', 'cnpj');
  END IF;
END$$;
""".strip()
    )

    # Rename column only if needed.
    op.execute(
        """
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='clients' AND column_name='cpf'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='clients' AND column_name='documento'
  ) THEN
    ALTER TABLE clients RENAME COLUMN cpf TO documento;
  END IF;
END$$;
""".strip()
    )

    op.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS tipo_documento tenant_documento_tipo NOT NULL DEFAULT 'cpf'")
    op.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone_mobile VARCHAR(40)")
    op.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS email VARCHAR(254)")
    op.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_street VARCHAR(200)")
    op.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_number VARCHAR(40)")
    op.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_complement VARCHAR(200)")
    op.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_neighborhood VARCHAR(120)")
    op.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_city VARCHAR(120)")
    op.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_state VARCHAR(2)")
    op.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS address_zip VARCHAR(16)")

    # Add index to speed up searches by email.
    op.execute("CREATE INDEX IF NOT EXISTS ix_clients_email ON clients (email)")


def downgrade() -> None:
    # Best-effort rollback (keeps legacy data).
    op.execute("DROP INDEX IF EXISTS ix_clients_email")

    op.execute("ALTER TABLE clients DROP COLUMN IF EXISTS address_zip")
    op.execute("ALTER TABLE clients DROP COLUMN IF EXISTS address_state")
    op.execute("ALTER TABLE clients DROP COLUMN IF EXISTS address_city")
    op.execute("ALTER TABLE clients DROP COLUMN IF EXISTS address_neighborhood")
    op.execute("ALTER TABLE clients DROP COLUMN IF EXISTS address_complement")
    op.execute("ALTER TABLE clients DROP COLUMN IF EXISTS address_number")
    op.execute("ALTER TABLE clients DROP COLUMN IF EXISTS address_street")
    op.execute("ALTER TABLE clients DROP COLUMN IF EXISTS email")
    op.execute("ALTER TABLE clients DROP COLUMN IF EXISTS phone_mobile")
    op.execute("ALTER TABLE clients DROP COLUMN IF EXISTS tipo_documento")

    # Rename back only if the legacy column is absent.
    op.execute(
        """
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='clients' AND column_name='documento'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='clients' AND column_name='cpf'
  ) THEN
    ALTER TABLE clients RENAME COLUMN documento TO cpf;
  END IF;
END$$;
""".strip()
    )

    op.execute("ALTER TABLE parcerias DROP COLUMN IF EXISTS oab_number")

    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS address_zip")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS address_state")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS address_city")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS address_neighborhood")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS address_complement")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS address_number")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS address_street")

    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS oab_number")

