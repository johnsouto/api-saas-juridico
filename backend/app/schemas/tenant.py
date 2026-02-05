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
    criado_em: datetime
