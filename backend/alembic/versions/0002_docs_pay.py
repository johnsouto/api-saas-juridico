"""client docs + honorario payment + widen alembic_version

Revision ID: 0002_docs_pay
Revises: 0001_init
Create Date: 2026-02-03
"""

from alembic import op


revision = "0002_docs_pay"
down_revision = "0001_init"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Alembic's default alembic_version.version_num is VARCHAR(32).
    # Keep it future-proof (and fix environments where a longer revision was attempted).
    op.execute("ALTER TABLE alembic_version ALTER COLUMN version_num TYPE VARCHAR(64)")

    # documents: add client/honorario linkage + category + mime
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_id UUID")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS honorario_id UUID")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS categoria VARCHAR(50)")
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120)")

    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_client_id ON documents (client_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_honorario_id ON documents (honorario_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_categoria ON documents (categoria)")

    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_documents_client_id_clients'
          ) THEN
            ALTER TABLE documents
            ADD CONSTRAINT fk_documents_client_id_clients
            FOREIGN KEY (client_id) REFERENCES clients(id);
          END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_documents_honorario_id_honorarios'
          ) THEN
            ALTER TABLE documents
            ADD CONSTRAINT fk_documents_honorario_id_honorarios
            FOREIGN KEY (honorario_id) REFERENCES honorarios(id);
          END IF;
        END $$;
        """
    )

    # honorarios: payment fields + receipt FK
    op.execute("ALTER TABLE honorarios ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ")
    op.execute("ALTER TABLE honorarios ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(12, 2)")
    op.execute("ALTER TABLE honorarios ADD COLUMN IF NOT EXISTS meio_pagamento VARCHAR(40)")
    op.execute("ALTER TABLE honorarios ADD COLUMN IF NOT EXISTS comprovante_document_id UUID")

    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_honorarios_comprovante_document_id_documents'
          ) THEN
            ALTER TABLE honorarios
            ADD CONSTRAINT fk_honorarios_comprovante_document_id_documents
            FOREIGN KEY (comprovante_document_id) REFERENCES documents(id);
          END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # Drop constraints first (if they exist).
    op.execute("ALTER TABLE honorarios DROP CONSTRAINT IF EXISTS fk_honorarios_comprovante_document_id_documents")
    op.execute("ALTER TABLE documents DROP CONSTRAINT IF EXISTS fk_documents_honorario_id_honorarios")
    op.execute("ALTER TABLE documents DROP CONSTRAINT IF EXISTS fk_documents_client_id_clients")

    # Then indexes.
    op.execute("DROP INDEX IF EXISTS ix_documents_categoria")
    op.execute("DROP INDEX IF EXISTS ix_documents_honorario_id")
    op.execute("DROP INDEX IF EXISTS ix_documents_client_id")

    # Then columns.
    op.execute("ALTER TABLE honorarios DROP COLUMN IF EXISTS comprovante_document_id")
    op.execute("ALTER TABLE honorarios DROP COLUMN IF EXISTS meio_pagamento")
    op.execute("ALTER TABLE honorarios DROP COLUMN IF EXISTS valor_pago")
    op.execute("ALTER TABLE honorarios DROP COLUMN IF EXISTS pago_em")

    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS mime_type")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS categoria")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS honorario_id")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS client_id")

