"""parcerias + process.parceria_id + agenda/tarefas client_id + honorarios extra fields

Revision ID: 0004_parcerias_agenda_tarefas_honorarios
Revises: 0003_tenant_documento
Create Date: 2026-02-05
"""

from alembic import op


revision = "0004_parcerias_agenda_tarefas_honorarios"
down_revision = "0003_tenant_documento"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # parcerias table
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS parcerias (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL,
          nome VARCHAR(200) NOT NULL,
          email VARCHAR(254),
          telefone VARCHAR(40),
          tipo_documento tenant_documento_tipo NOT NULL,
          documento VARCHAR(32) NOT NULL,
          criado_em TIMESTAMPTZ,
          atualizado_em TIMESTAMPTZ,
          CONSTRAINT fk_parcerias_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id)
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_parcerias_tenant_id ON parcerias (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_parcerias_nome ON parcerias (nome)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_parcerias_email ON parcerias (email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_parcerias_documento ON parcerias (documento)")

    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'uq_parcerias_tenant_id_tipo_documento_documento'
          ) THEN
            ALTER TABLE parcerias
            ADD CONSTRAINT uq_parcerias_tenant_id_tipo_documento_documento
            UNIQUE (tenant_id, tipo_documento, documento);
          END IF;
        END $$;
        """
    )

    # processes.parceria_id
    op.execute("ALTER TABLE processes ADD COLUMN IF NOT EXISTS parceria_id UUID")
    op.execute("CREATE INDEX IF NOT EXISTS ix_processes_parceria_id ON processes (parceria_id)")
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_processes_parceria_id_parcerias'
          ) THEN
            ALTER TABLE processes
            ADD CONSTRAINT fk_processes_parceria_id_parcerias
            FOREIGN KEY (parceria_id) REFERENCES parcerias(id);
          END IF;
        END $$;
        """
    )

    # agenda_eventos.client_id
    op.execute("ALTER TABLE agenda_eventos ADD COLUMN IF NOT EXISTS client_id UUID")
    op.execute("CREATE INDEX IF NOT EXISTS ix_agenda_eventos_client_id ON agenda_eventos (client_id)")
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_agenda_eventos_client_id_clients'
          ) THEN
            ALTER TABLE agenda_eventos
            ADD CONSTRAINT fk_agenda_eventos_client_id_clients
            FOREIGN KEY (client_id) REFERENCES clients(id);
          END IF;
        END $$;
        """
    )

    # tarefas.client_id
    op.execute("ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS client_id UUID")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tarefas_client_id ON tarefas (client_id)")
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_tarefas_client_id_clients'
          ) THEN
            ALTER TABLE tarefas
            ADD CONSTRAINT fk_tarefas_client_id_clients
            FOREIGN KEY (client_id) REFERENCES clients(id);
          END IF;
        END $$;
        """
    )

    # honorarios: extra fields (parcelas / percentuais)
    op.execute("ALTER TABLE honorarios ADD COLUMN IF NOT EXISTS qtd_parcelas INTEGER NOT NULL DEFAULT 1")
    op.execute("ALTER TABLE honorarios ADD COLUMN IF NOT EXISTS percentual_exito SMALLINT")
    op.execute("ALTER TABLE honorarios ADD COLUMN IF NOT EXISTS percentual_parceiro SMALLINT")


def downgrade() -> None:
    op.execute("ALTER TABLE honorarios DROP COLUMN IF EXISTS percentual_parceiro")
    op.execute("ALTER TABLE honorarios DROP COLUMN IF EXISTS percentual_exito")
    op.execute("ALTER TABLE honorarios DROP COLUMN IF EXISTS qtd_parcelas")

    op.execute("ALTER TABLE tarefas DROP CONSTRAINT IF EXISTS fk_tarefas_client_id_clients")
    op.execute("DROP INDEX IF EXISTS ix_tarefas_client_id")
    op.execute("ALTER TABLE tarefas DROP COLUMN IF EXISTS client_id")

    op.execute("ALTER TABLE agenda_eventos DROP CONSTRAINT IF EXISTS fk_agenda_eventos_client_id_clients")
    op.execute("DROP INDEX IF EXISTS ix_agenda_eventos_client_id")
    op.execute("ALTER TABLE agenda_eventos DROP COLUMN IF EXISTS client_id")

    op.execute("ALTER TABLE processes DROP CONSTRAINT IF EXISTS fk_processes_parceria_id_parcerias")
    op.execute("DROP INDEX IF EXISTS ix_processes_parceria_id")
    op.execute("ALTER TABLE processes DROP COLUMN IF EXISTS parceria_id")

    op.execute("DROP TABLE IF EXISTS parcerias")

