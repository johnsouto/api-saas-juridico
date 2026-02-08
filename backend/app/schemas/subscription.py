from __future__ import annotations

import uuid
from datetime import datetime

from app.models.enums import BillingProvider, PlanCode, SubscriptionStatus
from app.schemas.common import APIModel


class SubscriptionOut(APIModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    plan_code: PlanCode
    status: SubscriptionStatus
    provider: BillingProvider
    current_period_start: datetime | None
    current_period_end: datetime | None
    grace_period_end: datetime | None
    cancel_at_period_end: bool
    criado_em: datetime
