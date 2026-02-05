"""tenants: support CPF/CNPJ (documento + tipo_documento)

Revision ID: 0003_tenant_documento
Revises: 0002_docs_pay
Create Date: 2026-02-04
"""

from alembic import op


revision = "0003_tenant_documento"
down_revision = "0002_docs_pay"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enum type (safe / idempotent)
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_documento_tipo') THEN
            CREATE TYPE tenant_documento_tipo AS ENUM ('cpf', 'cnpj');
          END IF;
        END $$;
        """
    )

    # Columns
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS tipo_documento tenant_documento_tipo")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS documento VARCHAR(32)")

    # Backfill from legacy cnpj column where possible.
    op.execute("UPDATE tenants SET tipo_documento = 'cnpj' WHERE tipo_documento IS NULL")
    op.execute("UPDATE tenants SET documento = COALESCE(documento, cnpj) WHERE documento IS NULL")
    # If somehow documento is still null, derive a stable placeholder from the UUID (<= 32 chars).
    op.execute(
        """
        UPDATE tenants
        SET documento = substring(replace(id::text, '-', ''), 1, 32)
        WHERE documento IS NULL
        """
    )

    # Legacy: allow null CNPJ for PF tenants.
    op.execute("ALTER TABLE tenants ALTER COLUMN cnpj DROP NOT NULL")

    # Enforce not-null on the new canonical columns.
    op.execute("ALTER TABLE tenants ALTER COLUMN tipo_documento SET NOT NULL")
    op.execute("ALTER TABLE tenants ALTER COLUMN documento SET NOT NULL")

    # Indexes
    op.execute("CREATE INDEX IF NOT EXISTS ix_tenants_tipo_documento ON tenants (tipo_documento)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tenants_documento ON tenants (documento)")

    # Uniqueness on (tipo_documento, documento)
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'uq_tenants_tipo_documento_documento'
          ) THEN
            ALTER TABLE tenants
            ADD CONSTRAINT uq_tenants_tipo_documento_documento
            UNIQUE (tipo_documento, documento);
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE tenants DROP CONSTRAINT IF EXISTS uq_tenants_tipo_documento_documento")
    op.execute("DROP INDEX IF EXISTS ix_tenants_documento")
    op.execute("DROP INDEX IF EXISTS ix_tenants_tipo_documento")

    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS documento")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS tipo_documento")

    # Keep legacy behavior (cnpj required) on downgrade.
    op.execute("ALTER TABLE tenants ALTER COLUMN cnpj SET NOT NULL")

    # Drop enum type if unused.
    op.execute("DROP TYPE IF EXISTS tenant_documento_tipo")

