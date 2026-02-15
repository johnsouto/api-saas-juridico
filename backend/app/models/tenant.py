from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Enum, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDBaseMixin
from app.models.enums import TenantDocumentoTipo


class Tenant(UUIDBaseMixin, Base):
    __tablename__ = "tenants"

    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="ACTIVE", index=True)
    delete_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delete_scheduled_for: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    delete_reason_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    delete_reason_text: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    delete_access_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Legacy (kept for backward-compatibility / existing DBs). New tenants may not have CNPJ.
    cnpj: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True, index=True)
    tipo_documento: Mapped[TenantDocumentoTipo] = mapped_column(
        Enum(TenantDocumentoTipo, name="tenant_documento_tipo"),
        nullable=False,
        default=TenantDocumentoTipo.cnpj,
    )
    documento: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)

    # Address (optional) - data of the law firm / tenant.
    address_street: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    address_complement: Mapped[str | None] = mapped_column(String(200), nullable=True)
    address_neighborhood: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address_city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address_state: Mapped[str | None] = mapped_column(String(2), nullable=True)
    address_zip: Mapped[str | None] = mapped_column(String(16), nullable=True)

    users: Mapped[list["User"]] = relationship(back_populates="tenant")
    subscription: Mapped[Optional["Subscription"]] = relationship(
        "Subscription",
        back_populates="tenant",
        uselist=False,
    )


from app.models.subscription import Subscription  # noqa: E402
from app.models.user import User  # noqa: E402
