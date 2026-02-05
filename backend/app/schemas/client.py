from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import Field

from app.schemas.common import APIModel


class ClientCreate(APIModel):
    nome: str = Field(min_length=2, max_length=200)
    cpf: str = Field(min_length=11, max_length=14)
    dados_contato: dict[str, Any] | None = None


class ClientUpdate(APIModel):
    nome: str | None = Field(default=None, min_length=2, max_length=200)
    cpf: str | None = Field(default=None, min_length=11, max_length=14)
    dados_contato: dict[str, Any] | None = None


class ClientOut(APIModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    nome: str
    cpf: str
    dados_contato: dict[str, Any] | None
    criado_em: datetime

