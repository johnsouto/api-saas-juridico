from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import EmailStr

from app.schemas.auth import TenantRegisterRequest
from app.schemas.common import APIModel
from app.schemas.tenant import TenantOut
from app.schemas.token import TokenPair
from app.schemas.user import UserOut
from app.models.enums import TenantDocumentoTipo


class PlatformTenantCreate(TenantRegisterRequest):
    """
    Same payload as /auth/register-tenant, but intended for the SaaS operator.
    """


class PlatformTrialTenantCreate(APIModel):
    """
    Payload for operator-created FREE tenants that will set password on first access via invite link.

    We intentionally do not ask for an initial password here.
    """

    tenant_nome: str
    tenant_tipo_documento: TenantDocumentoTipo = TenantDocumentoTipo.cnpj
    tenant_documento: str
    tenant_slug: str
    admin_nome: str
    admin_email: EmailStr


class PlatformTenantCreatedOut(APIModel):
    tenant: TenantOut
    admin_user: UserOut
    tokens: TokenPair


class PlatformTenantListItem(APIModel):
    id: uuid.UUID
    nome: str
    cnpj: str | None
    tipo_documento: str
    documento: str
    slug: str
    criado_em: datetime
    plan_nome: str | None
    subscription_status: str | None
    subscription_ativo: bool | None
    subscription_validade: datetime | None
