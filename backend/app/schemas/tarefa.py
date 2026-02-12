from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.models.enums import TarefaStatus
from app.schemas.common import APIModel


class TarefaCreate(APIModel):
    titulo: str = Field(min_length=2, max_length=200)
    descricao: str | None = Field(default=None, max_length=2000)
    status: TarefaStatus = TarefaStatus.pendente
    responsavel_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    prazo_em: datetime | None = None


class TarefaUpdate(APIModel):
    titulo: str | None = Field(default=None, min_length=2, max_length=200)
    descricao: str | None = Field(default=None, max_length=2000)
    status: TarefaStatus | None = None
    responsavel_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    prazo_em: datetime | None = None


class TarefaOut(APIModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    titulo: str
    descricao: str | None
    status: TarefaStatus
    responsavel_id: uuid.UUID | None
    client_id: uuid.UUID | None
    related_process_id: uuid.UUID | None
    attachment_document_id: uuid.UUID | None
    source: str | None
    attachment_is_temporary: bool
    prazo_em: datetime | None
    criado_em: datetime
