from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Integer, Numeric, String, SmallInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDBaseMixin
from app.models.enums import HonorarioStatus

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.document import Document
    from app.models.process import Process


class Honorario(UUIDBaseMixin, Base):
    __tablename__ = "honorarios"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False, index=True)
    process_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("processes.id"),
        nullable=True,
        index=True,
    )

    valor: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    data_vencimento: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[HonorarioStatus] = mapped_column(Enum(HonorarioStatus, name="honorario_status"), nullable=False)

    # Novos campos (UX/negócio): parcelamento e êxito
    qtd_parcelas: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    percentual_exito: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    percentual_parceiro: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    client: Mapped["Client"] = relationship(back_populates="honorarios")
    process: Mapped["Process | None"] = relationship(back_populates="honorarios")
    documentos: Mapped[list["Document"]] = relationship(
        back_populates="honorario",
        foreign_keys="Document.honorario_id",
    )

    # Pagamento (conferência/baixa manual)
    pago_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    valor_pago: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    meio_pagamento: Mapped[str | None] = mapped_column(String(40), nullable=True)
    comprovante_document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id"),
        nullable=True,
    )
    comprovante: Mapped["Document | None"] = relationship(foreign_keys=[comprovante_document_id])
