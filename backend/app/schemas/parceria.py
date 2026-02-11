from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import EmailStr, Field

from app.models.enums import TenantDocumentoTipo
from app.schemas.common import APIModel


class ParceriaCreate(APIModel):
    nome: str = Field(min_length=2, max_length=200)
    email: EmailStr | None = None
    telefone: str | None = Field(default=None, max_length=40)
    oab_number: str | None = Field(default=None, max_length=40)
    tipo_documento: TenantDocumentoTipo = TenantDocumentoTipo.cpf
    documento: str = Field(min_length=8, max_length=32)


class ParceriaUpdate(APIModel):
    nome: str | None = Field(default=None, min_length=2, max_length=200)
    email: EmailStr | None = None
    telefone: str | None = Field(default=None, max_length=40)
    oab_number: str | None = Field(default=None, max_length=40)
    tipo_documento: TenantDocumentoTipo | None = None
    documento: str | None = Field(default=None, min_length=8, max_length=32)


class ParceriaOut(APIModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    nome: str
    email: str | None
    telefone: str | None
    oab_number: str | None = None
    tipo_documento: TenantDocumentoTipo
    documento: str
    criado_em: datetime
