"""tenants: add is_active flag

Revision ID: 0006_tenant_is_active
Revises: 0005_process_status_nicho
Create Date: 2026-02-06
"""

from alembic import op


revision = "0006_tenant_is_active"
down_revision = "0005_process_status_nicho"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tenants_is_active ON tenants (is_active)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_tenants_is_active")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS is_active")

