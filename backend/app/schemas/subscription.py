from __future__ import annotations

import uuid
from datetime import datetime

from app.models.enums import SubscriptionStatus
from app.schemas.common import APIModel


class SubscriptionOut(APIModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    plan_id: uuid.UUID
    status: SubscriptionStatus
    stripe_id: str | None
    ativo: bool
    validade: datetime | None
    criado_em: datetime

