from __future__ import annotations

import uuid
from datetime import datetime

from app.models.enums import BillingPeriod, PlanCode
from app.schemas.common import APIModel


class PlanOut(APIModel):
    id: uuid.UUID
    code: PlanCode
    nome: str
    max_users: int
    max_storage_mb: int
    price_cents: int
    currency: str
    billing_period: BillingPeriod
    criado_em: datetime
