from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDBaseMixin

if TYPE_CHECKING:
    from app.models.agenda_evento import AgendaEvento
    from app.models.client import Client
    from app.models.document import Document
    from app.models.honorario import Honorario
    from app.models.parceria import Parceria


class Process(UUIDBaseMixin, Base):
    __tablename__ = "processes"
    __table_args__ = (UniqueConstraint("tenant_id", "numero"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True)
    parceria_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("parcerias.id"),
        nullable=True,
        index=True,
    )

    numero: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="ativo")
    nicho: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)

    client: Mapped["Client"] = relationship(back_populates="processos")
    parceria: Mapped["Parceria | None"] = relationship(back_populates="processos")
    honorarios: Mapped[list["Honorario"]] = relationship(back_populates="process")
    documentos: Mapped[list["Document"]] = relationship(back_populates="process")
    agenda_eventos: Mapped[list["AgendaEvento"]] = relationship(back_populates="process")


# Ensure Parceria is registered before mapper configuration tries to resolve the string name.
from app.models.parceria import Parceria  # noqa: E402,F401
