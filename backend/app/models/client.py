from __future__ import annotations

import uuid
from typing import Any
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDBaseMixin
from app.models.enums import TenantDocumentoTipo

if TYPE_CHECKING:
    from app.models.client_case import ClientCase
    from app.models.client_partnership import ClientPartnership
    from app.models.document import Document
    from app.models.honorario import Honorario
    from app.models.process import Process


class Client(UUIDBaseMixin, Base):
    __tablename__ = "clients"
    __table_args__ = (UniqueConstraint("tenant_id", "documento"),)

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)

    nome: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    tipo_documento: Mapped[TenantDocumentoTipo] = mapped_column(
        Enum(TenantDocumentoTipo, name="tenant_documento_tipo"),
        nullable=False,
        default=TenantDocumentoTipo.cpf,
    )
    documento: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    phone_mobile: Mapped[str | None] = mapped_column(String(40), nullable=True)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True, index=True)

    address_street: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    address_complement: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_neighborhood: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address_city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address_state: Mapped[str | None] = mapped_column(String(2), nullable=True)
    address_zip: Mapped[str | None] = mapped_column(String(16), nullable=True)

    # Legacy (kept for backward-compatibility). Prefer explicit fields above.
    dados_contato: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    processos: Mapped[list["Process"]] = relationship(back_populates="client")
    cases: Mapped[list["ClientCase"]] = relationship(back_populates="client")
    partnership_links: Mapped[list["ClientPartnership"]] = relationship(back_populates="client")
    honorarios: Mapped[list["Honorario"]] = relationship(back_populates="client")
    documentos: Mapped[list["Document"]] = relationship(back_populates="client")
