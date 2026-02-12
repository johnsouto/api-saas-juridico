from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDBaseMixin
from app.models.enums import TenantDocumentoTipo

if TYPE_CHECKING:
    from app.models.client_partnership import ClientPartnership
    from app.models.process import Process


class Parceria(UUIDBaseMixin, Base):
    __tablename__ = "parcerias"
    __table_args__ = (UniqueConstraint("tenant_id", "tipo_documento", "documento"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)

    nome: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True, index=True)
    telefone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    oab_uf: Mapped[str | None] = mapped_column(String(2), nullable=True)
    oab_number: Mapped[str | None] = mapped_column(String(40), nullable=True)

    address_street: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    address_complement: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_neighborhood: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address_city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address_state: Mapped[str | None] = mapped_column(String(2), nullable=True)
    address_zip: Mapped[str | None] = mapped_column(String(16), nullable=True)

    tipo_documento: Mapped[TenantDocumentoTipo] = mapped_column(
        Enum(TenantDocumentoTipo, name="tenant_documento_tipo"),
        nullable=False,
        default=TenantDocumentoTipo.cpf,
    )
    documento: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    client_links: Mapped[list["ClientPartnership"]] = relationship(back_populates="parceria")
    processos: Mapped[list["Process"]] = relationship(back_populates="parceria")
