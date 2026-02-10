from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class BugReportCreate(APIModel):
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(min_length=5, max_length=5000)
    url: str | None = Field(default=None, max_length=500)
    user_agent: str | None = Field(default=None, max_length=500)


class BugReportOut(APIModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    title: str
    description: str
    url: str | None = None
    user_agent: str | None = None
    criado_em: datetime
