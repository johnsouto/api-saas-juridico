from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class ClientCaseCreate(APIModel):
    title: str | None = Field(default=None, max_length=200)
    content: str = Field(min_length=2, max_length=10_000)


class ClientCaseUpdate(APIModel):
    title: str | None = Field(default=None, max_length=200)
    content: str | None = Field(default=None, min_length=2, max_length=10_000)


class ClientCaseOut(APIModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    client_id: uuid.UUID
    title: str | None
    content: str
    criado_em: datetime
    atualizado_em: datetime
