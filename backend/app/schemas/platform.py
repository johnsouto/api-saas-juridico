from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import EmailStr, Field
from app.schemas.common import APIModel
from app.schemas.tenant import TenantOut
from app.schemas.token import TokenPair
from app.schemas.user import UserOut
from app.schemas.subscription import SubscriptionOut
from app.models.enums import PlanCode, SubscriptionStatus, TenantDocumentoTipo


class PlatformTenantCreate(APIModel):
    """
    Payload used by the SaaS operator to provision a tenant with an initial password.

    Note: We keep a single `admin_nome` field here to keep the platform flow simple
    and backward-compatible with the existing UI.
    """

    tenant_nome: str = Field(min_length=2, max_length=200)
    tenant_tipo_documento: TenantDocumentoTipo = TenantDocumentoTipo.cnpj
    tenant_documento: str = Field(min_length=8, max_length=32)
    tenant_slug: str = Field(min_length=2, max_length=80)

    admin_nome: str = Field(min_length=2, max_length=200)
    admin_email: EmailStr
    admin_senha: str = Field(min_length=8, max_length=128)


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
    is_active: bool

    # Output should not 500 if legacy/seed data uses a non-deliverable domain (e.g. *.local).
    admin_email: str | None = None
    admin_nome: str | None = None
    admin_is_active: bool | None = None

    users_total: int = 0
    users_active: int = 0
    storage_used_bytes: int = 0

    plan_code: PlanCode | None = None
    plan_nome: str | None = None
    subscription_status: SubscriptionStatus | None = None
    current_period_end: datetime | None = None
    grace_period_end: datetime | None = None
    provider: str | None = None

    # Per-tenant overrides (set by platform admin). When NULL, defaults from the plan apply.
    max_clients_override: int | None = None
    max_storage_mb_override: int | None = None


class PlatformTenantLimitsUpdate(APIModel):
    """
    Optional per-tenant overrides for product limits.

    Note: sending `null` clears the override and falls back to the plan default.
    """

    max_clients_override: int | None = Field(default=None, ge=1, le=100000)
    max_storage_mb_override: int | None = Field(default=None, ge=10, le=1000000)


class PlatformTenantLimitsOut(APIModel):
    message: str
    tenant_id: uuid.UUID
    max_clients_override: int | None = None
    max_storage_mb_override: int | None = None


class PlatformResendInviteOut(APIModel):
    message: str
    # Output should not 500 if legacy/seed data uses a non-deliverable domain (e.g. *.local).
    email: str


class PlatformTenantStatusOut(APIModel):
    message: str
    tenant_id: uuid.UUID
    is_active: bool


class PlatformTenantDeletedOut(APIModel):
    message: str
    tenant_id: uuid.UUID


class PlatformBillingEventOut(APIModel):
    id: uuid.UUID
    criado_em: datetime
    provider: str
    event_type: str
    external_id: str | None = None
    payload_json: dict[str, Any]


class PlatformTenantDetailOut(APIModel):
    tenant: TenantOut
    admin_users: list[UserOut]
    subscription: SubscriptionOut | None = None
    billing_events: list[PlatformBillingEventOut] = []
