"""Client partnerships join table.

Revision ID: 0021_client_partnerships
Revises: 0020_parcerias_oab_endereco
Create Date: 2026-02-12
"""

from __future__ import annotations

from alembic import op


revision = "0021_client_partnerships"
down_revision = "0020_parcerias_oab_endereco"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS client_partnerships (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL,
          client_id UUID NOT NULL,
          partnership_id UUID NOT NULL,
          criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_client_partnerships_unique UNIQUE (tenant_id, client_id, partnership_id),
          CONSTRAINT fk_client_partnerships_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id),
          CONSTRAINT fk_client_partnerships_client_id_clients FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
          CONSTRAINT fk_client_partnerships_partnership_id_parcerias FOREIGN KEY (partnership_id) REFERENCES parcerias(id) ON DELETE CASCADE
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_client_partnerships_tenant_id ON client_partnerships (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_client_partnerships_client_id ON client_partnerships (client_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_client_partnerships_partnership_id ON client_partnerships (partnership_id)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_client_partnerships_partnership_id")
    op.execute("DROP INDEX IF EXISTS ix_client_partnerships_client_id")
    op.execute("DROP INDEX IF EXISTS ix_client_partnerships_tenant_id")
    op.execute("DROP TABLE IF EXISTS client_partnerships")
