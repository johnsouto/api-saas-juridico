"""Clients soft delete (is_active).

Revision ID: 0014_client_soft_delete
Revises: 0013_profile_clients_parcerias_fields
Create Date: 2026-02-11
"""

from __future__ import annotations

from alembic import op


revision = "0014_client_soft_delete"
down_revision = "0013_profile_clients_parcerias_fields"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Soft-delete flag to avoid FK integrity errors when "deleting" clients.
    op.execute("ALTER TABLE clients ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true")
    op.execute("CREATE INDEX IF NOT EXISTS ix_clients_tenant_id_is_active ON clients (tenant_id, is_active)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_clients_tenant_id_is_active")
    op.execute("ALTER TABLE clients DROP COLUMN IF EXISTS is_active")

