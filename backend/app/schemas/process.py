from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel
from app.models.enums import ProcessStatus


class ProcessCreate(APIModel):
    client_id: uuid.UUID
    parceria_id: uuid.UUID | None = None
    numero: str = Field(min_length=3, max_length=64)
    status: ProcessStatus = ProcessStatus.ativo
    nicho: str | None = Field(default=None, min_length=2, max_length=60)


class ProcessUpdate(APIModel):
    client_id: uuid.UUID | None = None
    parceria_id: uuid.UUID | None = None
    numero: str | None = Field(default=None, min_length=3, max_length=64)
    status: ProcessStatus | None = None
    nicho: str | None = Field(default=None, min_length=2, max_length=60)


class ProcessOut(APIModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    client_id: uuid.UUID
    parceria_id: uuid.UUID | None
    numero: str
    status: ProcessStatus
    nicho: str | None
    client_nome: str | None = None
    criado_em: datetime
