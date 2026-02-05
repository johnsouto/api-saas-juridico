from __future__ import annotations

from decimal import Decimal

from sqlalchemy import Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDBaseMixin


class Plan(UUIDBaseMixin, Base):
    __tablename__ = "plans"

    nome: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    max_users: Mapped[int] = mapped_column(Integer, nullable=False)
    max_storage_mb: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))

    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="plan")


from app.models.subscription import Subscription  # noqa: E402

