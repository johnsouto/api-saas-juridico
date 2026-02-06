from __future__ import annotations

import uuid
from typing import Any
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDBaseMixin

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.honorario import Honorario
    from app.models.process import Process


class Client(UUIDBaseMixin, Base):
    __tablename__ = "clients"
    __table_args__ = (UniqueConstraint("tenant_id", "cpf"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)

    nome: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    cpf: Mapped[str] = mapped_column(String(14), nullable=False, index=True)
    dados_contato: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    processos: Mapped[list["Process"]] = relationship(back_populates="client")
    honorarios: Mapped[list["Honorario"]] = relationship(back_populates="client")
    documentos: Mapped[list["Document"]] = relationship(back_populates="client")
