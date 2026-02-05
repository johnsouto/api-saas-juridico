from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDBaseMixin

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.honorario import Honorario
    from app.models.process import Process


class Document(UUIDBaseMixin, Base):
    __tablename__ = "documents"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    process_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("processes.id"), nullable=True, index=True)
    client_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True)
    honorario_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("honorarios.id"), nullable=True, index=True)

    categoria: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    mime_type: Mapped[str | None] = mapped_column(String(120), nullable=True)

    s3_key: Mapped[str] = mapped_column(String(1024), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    size_bytes: Mapped[int] = mapped_column(nullable=False)

    process: Mapped["Process | None"] = relationship(back_populates="documentos")
    client: Mapped["Client | None"] = relationship(back_populates="documentos")
    honorario: Mapped["Honorario | None"] = relationship(
        back_populates="documentos",
        foreign_keys=[honorario_id],
    )
