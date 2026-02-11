from __future__ import annotations

import uuid
from datetime import datetime

from app.models.enums import TenantDocumentoTipo
from app.schemas.common import APIModel


class TenantOut(APIModel):
    id: uuid.UUID
    nome: str
    # Legacy field (may be null for PF tenants).
    cnpj: str | None
    tipo_documento: TenantDocumentoTipo
    documento: str
    slug: str
    address_street: str | None = None
    address_number: str | None = None
    address_complement: str | None = None
    address_neighborhood: str | None = None
    address_city: str | None = None
    address_state: str | None = None
    address_zip: str | None = None
    criado_em: datetime
