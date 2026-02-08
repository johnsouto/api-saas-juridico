from __future__ import annotations

from decimal import Decimal

from sqlalchemy import Enum, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDBaseMixin
from app.models.enums import BillingPeriod, PlanCode


class Plan(UUIDBaseMixin, Base):
    __tablename__ = "plans"

    code: Mapped[PlanCode] = mapped_column(Enum(PlanCode, name="plan_code"), nullable=False, unique=True, index=True)
    nome: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    max_users: Mapped[int] = mapped_column(Integer, nullable=False)
    max_storage_mb: Mapped[int] = mapped_column(Integer, nullable=False)
    # Legacy column (kept for backward-compatibility). Prefer `price_cents`.
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=Decimal("0.00"))

    price_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="BRL")
    billing_period: Mapped[BillingPeriod] = mapped_column(
        Enum(BillingPeriod, name="billing_period"),
        nullable=False,
        default=BillingPeriod.NONE,
    )

    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="plan")


from app.models.subscription import Subscription  # noqa: E402
