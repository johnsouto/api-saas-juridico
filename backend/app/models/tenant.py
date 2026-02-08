from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Enum, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDBaseMixin
from app.models.enums import TenantDocumentoTipo


class Tenant(UUIDBaseMixin, Base):
    __tablename__ = "tenants"

    nome: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # Legacy (kept for backward-compatibility / existing DBs). New tenants may not have CNPJ.
    cnpj: Mapped[str | None] = mapped_column(String(32), nullable=True, unique=True, index=True)
    tipo_documento: Mapped[TenantDocumentoTipo] = mapped_column(
        Enum(TenantDocumentoTipo, name="tenant_documento_tipo"),
        nullable=False,
        default=TenantDocumentoTipo.cnpj,
    )
    documento: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)

    users: Mapped[list["User"]] = relationship(back_populates="tenant")
    subscription: Mapped["Subscription" | None] = relationship(back_populates="tenant", uselist=False)


from app.models.subscription import Subscription  # noqa: E402
from app.models.user import User  # noqa: E402
