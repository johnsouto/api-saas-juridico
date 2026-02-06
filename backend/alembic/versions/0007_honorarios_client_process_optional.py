"""honorarios: add client_id and allow honorario without process

Revision ID: 0007_honorarios_client_process_optional
Revises: 0006_tenant_is_active
Create Date: 2026-02-06
"""

from alembic import op


revision = "0007_honorarios_client_process_optional"
down_revision = "0006_tenant_is_active"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1) Add client_id (nullable at first) so we can backfill safely.
    op.execute("ALTER TABLE honorarios ADD COLUMN IF NOT EXISTS client_id UUID")

    # 2) Backfill existing rows from the linked process.
    op.execute(
        """
        UPDATE honorarios h
        SET client_id = p.client_id
        FROM processes p
        WHERE h.client_id IS NULL
          AND h.process_id = p.id
        """
    )

    # 3) Add FK + index.
    op.execute("CREATE INDEX IF NOT EXISTS ix_honorarios_client_id ON honorarios (client_id)")
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'fk_honorarios_client_id_clients'
          ) THEN
            ALTER TABLE honorarios
            ADD CONSTRAINT fk_honorarios_client_id_clients
            FOREIGN KEY (client_id) REFERENCES clients(id);
          END IF;
        END $$;
        """
    )

    # 4) Now enforce NOT NULL.
    op.execute("ALTER TABLE honorarios ALTER COLUMN client_id SET NOT NULL")

    # 5) Allow honorários "em aberto" without a process.
    op.execute("ALTER TABLE honorarios ALTER COLUMN process_id DROP NOT NULL")


def downgrade() -> None:
    # Best-effort downgrade. If there are honorários without a process, we cannot restore NOT NULL safely.
    op.execute(
        """
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM honorarios WHERE process_id IS NULL) THEN
            ALTER TABLE honorarios ALTER COLUMN process_id SET NOT NULL;
          END IF;
        END $$;
        """
    )

    op.execute("ALTER TABLE honorarios DROP CONSTRAINT IF EXISTS fk_honorarios_client_id_clients")
    op.execute("DROP INDEX IF EXISTS ix_honorarios_client_id")
    op.execute("ALTER TABLE honorarios DROP COLUMN IF EXISTS client_id")

