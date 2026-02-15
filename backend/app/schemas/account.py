from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import Field

from app.models.enums import PlanCode
from app.schemas.common import APIModel


DeleteReasonCode = Literal["encerramento", "nao_atendeu", "custo", "outro"]


class AccountDeleteRequestIn(APIModel):
    confirm_text: str = Field(min_length=2, max_length=20)
    reason: DeleteReasonCode | None = None
    reason_text: str | None = Field(default=None, max_length=1000)


class AccountDeleteRequestOut(APIModel):
    ok: bool = True
    plan_code: PlanCode
    delete_scheduled_for: datetime
    export_requested: bool = False
    export_id: uuid.UUID | None = None
    export_rate_limited: bool = False
    export_retry_after_seconds: int | None = None
    latest_export_id: uuid.UUID | None = None
