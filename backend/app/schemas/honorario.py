from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import Field

from app.models.enums import HonorarioStatus
from app.schemas.common import APIModel


class HonorarioCreate(APIModel):
    process_id: uuid.UUID
    valor: Decimal
    data_vencimento: date
    qtd_parcelas: int = Field(default=1, ge=1, le=120)
    percentual_exito: int | None = Field(default=None, ge=0, le=100)
    percentual_parceiro: int | None = Field(default=None, ge=0, le=100)
    status: HonorarioStatus = HonorarioStatus.aberto


class HonorarioUpdate(APIModel):
    valor: Decimal | None = None
    data_vencimento: date | None = None
    qtd_parcelas: int | None = Field(default=None, ge=1, le=120)
    percentual_exito: int | None = Field(default=None, ge=0, le=100)
    percentual_parceiro: int | None = Field(default=None, ge=0, le=100)
    status: HonorarioStatus | None = None


class HonorarioOut(APIModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    process_id: uuid.UUID
    valor: Decimal
    data_vencimento: date
    qtd_parcelas: int
    percentual_exito: int | None
    percentual_parceiro: int | None
    status: HonorarioStatus
    pago_em: datetime | None
    valor_pago: Decimal | None
    meio_pagamento: str | None
    comprovante_document_id: uuid.UUID | None
    criado_em: datetime


class HonorarioPaymentConfirm(APIModel):
    valor_pago: Decimal | None = None
    meio_pagamento: str | None = Field(default=None, max_length=40)
    pago_em: datetime | None = None
