from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.models.enums import PlanCode, SubscriptionStatus
from app.schemas.common import APIModel


class BillingLimits(APIModel):
    max_users: int
    max_clients: int | None = None
    max_storage_mb: int


class BillingStatusOut(APIModel):
    tenant_id: uuid.UUID
    plan_code: PlanCode
    status: SubscriptionStatus
    current_period_end: datetime | None = None
    grace_period_end: datetime | None = None
    is_plus_effective: bool
    limits: BillingLimits
    message: str | None = None


class BillingCheckoutOut(APIModel):
    # Card flow
    checkout_url: str | None = None

    # PIX flow
    pix_qr_code: str | None = None
    pix_copy_paste: str | None = None
    expires_at: datetime | None = None


class BillingCancelOut(APIModel):
    ok: bool = True
    message: str = Field(default="Assinatura cancelada (ou marcada para cancelamento)")
