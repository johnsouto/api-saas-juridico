from __future__ import annotations

import uuid
from decimal import Decimal
from datetime import datetime

from app.schemas.common import APIModel


class PlanOut(APIModel):
    id: uuid.UUID
    nome: str
    max_users: int
    max_storage_mb: int
    price: Decimal
    criado_em: datetime

