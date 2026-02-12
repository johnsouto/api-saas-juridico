"""Ensure documents.categoria column and index exist.

Revision ID: 0017_document_categoria_options
Revises: 0016_process_last_movement
Create Date: 2026-02-12
"""

from __future__ import annotations

from alembic import op


revision = "0017_document_categoria_options"
down_revision = "0016_process_last_movement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE documents ADD COLUMN IF NOT EXISTS categoria VARCHAR(50)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_documents_categoria ON documents (categoria)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_documents_categoria")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS categoria")
