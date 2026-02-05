"""processes: status options (ativo/inativo/outros) + nicho

Revision ID: 0005_process_status_nicho
Revises: 0004_parcerias_agenda_tarefas_honorarios
Create Date: 2026-02-05
"""

from alembic import op


revision = "0005_process_status_nicho"
down_revision = "0004_parcerias_agenda_tarefas_honorarios"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE processes ADD COLUMN IF NOT EXISTS nicho VARCHAR(60)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_processes_nicho ON processes (nicho)")

    # Normalize legacy statuses to the new 3-state model.
    op.execute(
        """
        UPDATE processes
        SET status = 'ativo'
        WHERE status IS NULL OR status IN ('aberto', 'andamento', 'em_andamento', 'ativo')
        """
    )
    op.execute(
        """
        UPDATE processes
        SET status = 'inativo'
        WHERE status IN ('encerrado', 'arquivado', 'inativo', 'finalizado')
        """
    )
    op.execute(
        """
        UPDATE processes
        SET status = 'outros'
        WHERE status NOT IN ('ativo', 'inativo', 'outros')
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_processes_nicho")
    op.execute("ALTER TABLE processes DROP COLUMN IF EXISTS nicho")

