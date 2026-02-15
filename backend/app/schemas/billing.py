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
    cancel_at_period_end: bool = True
    access_until: datetime | None = None
    refund_status: str = "NONE"
    export_requested: bool = False
    export_id: uuid.UUID | None = None
    export_rate_limited: bool = False
    export_retry_after_seconds: int | None = None
    latest_export_id: uuid.UUID | None = None


class BillingCancelIn(APIModel):
    generate_export_now: bool = False
