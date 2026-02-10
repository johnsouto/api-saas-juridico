from __future__ import annotations

from pydantic import EmailStr, Field

from app.models.enums import UserRole
from app.models.enums import TenantDocumentoTipo
from app.schemas.common import APIModel


class TenantRegisterRequest(APIModel):
    tenant_nome: str = Field(min_length=2, max_length=200)
    tenant_tipo_documento: TenantDocumentoTipo = TenantDocumentoTipo.cnpj
    tenant_documento: str = Field(min_length=8, max_length=32)
    tenant_slug: str = Field(min_length=2, max_length=80)

    first_name: str = Field(min_length=2, max_length=200)
    last_name: str = Field(min_length=2, max_length=200)
    admin_email: EmailStr
    admin_senha: str = Field(min_length=8, max_length=128)

    # Cloudflare Turnstile token (anti-bot). Required when TURNSTILE_SECRET_KEY is enabled.
    cf_turnstile_response: str | None = Field(default=None, min_length=1)


class InviteUserRequest(APIModel):
    email: EmailStr
    nome: str = Field(min_length=2, max_length=200)
    role: UserRole


class AcceptInviteRequest(APIModel):
    token: str
    senha: str = Field(min_length=8, max_length=128)


class ResetPasswordRequest(APIModel):
    email: EmailStr


class ResetPasswordConfirm(APIModel):
    token: str
    nova_senha: str = Field(min_length=8, max_length=128)
