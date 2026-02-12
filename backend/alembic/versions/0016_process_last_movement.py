"""Process last movement task linkage and temporary attachment support.

Revision ID: 0016_process_last_movement
Revises: 0015_subscription_limit_overrides
Create Date: 2026-02-12
"""

from __future__ import annotations

from alembic import op


revision = "0016_process_last_movement"
down_revision = "0015_subscription_limit_overrides"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS related_process_id UUID")
    op.execute("ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS attachment_document_id UUID")
    op.execute("ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS source VARCHAR(80)")
    op.execute("ALTER TABLE tarefas ADD COLUMN IF NOT EXISTS attachment_is_temporary BOOLEAN")
    op.execute("UPDATE tarefas SET attachment_is_temporary = FALSE WHERE attachment_is_temporary IS NULL")
    op.execute("ALTER TABLE tarefas ALTER COLUMN attachment_is_temporary SET DEFAULT FALSE")
    op.execute("ALTER TABLE tarefas ALTER COLUMN attachment_is_temporary SET NOT NULL")

    op.execute("CREATE INDEX IF NOT EXISTS ix_tarefas_related_process_id ON tarefas (related_process_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tarefas_attachment_document_id ON tarefas (attachment_document_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tarefas_source ON tarefas (source)")

    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_tarefas_related_process_id_processes'
          ) THEN
            ALTER TABLE tarefas
            ADD CONSTRAINT fk_tarefas_related_process_id_processes
            FOREIGN KEY (related_process_id) REFERENCES processes(id);
          END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_tarefas_attachment_document_id_documents'
          ) THEN
            ALTER TABLE tarefas
            ADD CONSTRAINT fk_tarefas_attachment_document_id_documents
            FOREIGN KEY (attachment_document_id) REFERENCES documents(id);
          END IF;
        END $$;
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS process_movements (
          id UUID PRIMARY KEY,
          tenant_id UUID NOT NULL,
          client_id UUID NOT NULL,
          process_id UUID NOT NULL,
          task_id UUID,
          title VARCHAR(200) NOT NULL,
          due_at TIMESTAMPTZ NOT NULL,
          document_id UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT fk_process_movements_tenant_id_tenants FOREIGN KEY (tenant_id) REFERENCES tenants(id),
          CONSTRAINT fk_process_movements_client_id_clients FOREIGN KEY (client_id) REFERENCES clients(id),
          CONSTRAINT fk_process_movements_process_id_processes FOREIGN KEY (process_id) REFERENCES processes(id),
          CONSTRAINT fk_process_movements_task_id_tarefas FOREIGN KEY (task_id) REFERENCES tarefas(id) ON DELETE SET NULL,
          CONSTRAINT fk_process_movements_document_id_documents FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_process_movements_tenant_id ON process_movements (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_process_movements_client_id ON process_movements (client_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_process_movements_process_id ON process_movements (process_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_process_movements_task_id ON process_movements (task_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_process_movements_document_id ON process_movements (document_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_process_movements_created_at ON process_movements (created_at)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_process_movements_created_at")
    op.execute("DROP INDEX IF EXISTS ix_process_movements_document_id")
    op.execute("DROP INDEX IF EXISTS ix_process_movements_task_id")
    op.execute("DROP INDEX IF EXISTS ix_process_movements_process_id")
    op.execute("DROP INDEX IF EXISTS ix_process_movements_client_id")
    op.execute("DROP INDEX IF EXISTS ix_process_movements_tenant_id")
    op.execute("DROP TABLE IF EXISTS process_movements")

    op.execute("ALTER TABLE tarefas DROP CONSTRAINT IF EXISTS fk_tarefas_attachment_document_id_documents")
    op.execute("ALTER TABLE tarefas DROP CONSTRAINT IF EXISTS fk_tarefas_related_process_id_processes")
    op.execute("DROP INDEX IF EXISTS ix_tarefas_source")
    op.execute("DROP INDEX IF EXISTS ix_tarefas_attachment_document_id")
    op.execute("DROP INDEX IF EXISTS ix_tarefas_related_process_id")
    op.execute("ALTER TABLE tarefas DROP COLUMN IF EXISTS attachment_is_temporary")
    op.execute("ALTER TABLE tarefas DROP COLUMN IF EXISTS source")
    op.execute("ALTER TABLE tarefas DROP COLUMN IF EXISTS attachment_document_id")
    op.execute("ALTER TABLE tarefas DROP COLUMN IF EXISTS related_process_id")
