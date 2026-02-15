from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDBaseMixin
from app.models.enums import BillingProvider, PlanCode, SubscriptionStatus


class Subscription(UUIDBaseMixin, Base):
    """
    Billing subscription for a tenant (1 row per tenant).

    We keep the "status" as the source of truth and compute an effective plan:
    - PLUS is effective when:
      - status == ACTIVE and now <= current_period_end
      - OR status == PAST_DUE and now <= grace_period_end
    - Otherwise the effective plan is FREE.
    """

    __tablename__ = "subscriptions"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tenants.id"),
        nullable=False,
        unique=True,
        index=True,
    )

    plan_code: Mapped[PlanCode] = mapped_column(
        Enum(PlanCode, name="plan_code"),
        ForeignKey("plans.code"),
        nullable=False,
        index=True,
        default=PlanCode.FREE,
    )

    # Optional per-tenant overrides (set by platform admin). When NULL, defaults from the plan apply.
    max_clients_override: Mapped[int | None] = mapped_column(nullable=True)
    max_storage_mb_override: Mapped[int | None] = mapped_column(nullable=True)

    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus, name="subscription_status"),
        nullable=False,
        default=SubscriptionStatus.free,
        index=True,
    )

    provider: Mapped[BillingProvider] = mapped_column(
        Enum(BillingProvider, name="billing_provider"),
        nullable=False,
        default=BillingProvider.FAKE,
    )

    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Only used for card subscriptions when a renewal fails.
    grace_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    cancellation_requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    refund_status: Mapped[str] = mapped_column(String(40), nullable=False, default="NONE")

    last_payment_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_payment_status: Mapped[str | None] = mapped_column(String(50), nullable=True)

    provider_customer_id: Mapped[str | None] = mapped_column(String(120), nullable=True)
    provider_subscription_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)
    provider_payment_id: Mapped[str | None] = mapped_column(String(120), nullable=True, index=True)

    tenant: Mapped["Tenant"] = relationship(back_populates="subscription")
    plan: Mapped["Plan"] = relationship(back_populates="subscriptions")


from app.models.plan import Plan  # noqa: E402
from app.models.tenant import Tenant  # noqa: E402
