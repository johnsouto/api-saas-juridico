from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class AgendaEventoCreate(APIModel):
    process_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    titulo: str = Field(min_length=2, max_length=200)
    tipo: str = Field(default="reuniao", min_length=2, max_length=40)
    inicio_em: datetime
    fim_em: datetime | None = None
    descricao: str | None = Field(default=None, max_length=1000)


class AgendaEventoUpdate(APIModel):
    process_id: uuid.UUID | None = None
    client_id: uuid.UUID | None = None
    titulo: str | None = Field(default=None, min_length=2, max_length=200)
    tipo: str | None = Field(default=None, min_length=2, max_length=40)
    inicio_em: datetime | None = None
    fim_em: datetime | None = None
    descricao: str | None = Field(default=None, max_length=1000)


class AgendaEventoOut(APIModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    process_id: uuid.UUID | None
    client_id: uuid.UUID | None
    titulo: str
    tipo: str
    inicio_em: datetime
    fim_em: datetime | None
    descricao: str | None
    criado_em: datetime


class AgendaEventoCreateOut(APIModel):
    event: AgendaEventoOut
    email_sent: bool
