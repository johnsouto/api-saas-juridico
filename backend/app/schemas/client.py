from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import EmailStr, Field

from app.models.enums import TenantDocumentoTipo
from app.schemas.common import APIModel
from app.schemas.document import DocumentOut
from app.schemas.parceria import ParceriaOut


class ClientCreate(APIModel):
    nome: str = Field(min_length=2, max_length=200)
    tipo_documento: TenantDocumentoTipo = TenantDocumentoTipo.cpf
    documento: str = Field(min_length=8, max_length=32)
    phone_mobile: str | None = Field(default=None, max_length=40)
    email: EmailStr | None = None

    address_street: str | None = Field(default=None, max_length=200)
    address_number: str | None = Field(default=None, max_length=40)
    address_complement: str | None = Field(default=None, max_length=200)
    address_neighborhood: str | None = Field(default=None, max_length=120)
    address_city: str | None = Field(default=None, max_length=120)
    address_state: str | None = Field(default=None, max_length=2)
    address_zip: str | None = Field(default=None, max_length=16)


class ClientUpdate(APIModel):
    nome: str | None = Field(default=None, min_length=2, max_length=200)
    tipo_documento: TenantDocumentoTipo | None = None
    documento: str | None = Field(default=None, min_length=8, max_length=32)
    phone_mobile: str | None = Field(default=None, max_length=40)
    email: EmailStr | None = None

    address_street: str | None = Field(default=None, max_length=200)
    address_number: str | None = Field(default=None, max_length=40)
    address_complement: str | None = Field(default=None, max_length=200)
    address_neighborhood: str | None = Field(default=None, max_length=120)
    address_city: str | None = Field(default=None, max_length=120)
    address_state: str | None = Field(default=None, max_length=2)
    address_zip: str | None = Field(default=None, max_length=16)


class ClientOut(APIModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    nome: str
    tipo_documento: TenantDocumentoTipo
    documento: str
    phone_mobile: str | None
    email: str | None

    address_street: str | None = None
    address_number: str | None = None
    address_complement: str | None = None
    address_neighborhood: str | None = None
    address_city: str | None = None
    address_state: str | None = None
    address_zip: str | None = None
    criado_em: datetime


class ClientDetailsOut(APIModel):
    client: ClientOut
    parcerias: list[ParceriaOut]
    documents: list[DocumentOut]
