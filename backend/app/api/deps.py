from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated, Callable

from fastapi import Depends
from fastapi import Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthError, ForbiddenError
from app.core.config import settings
from app.core.security import decode_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.tenant import Tenant
from app.models.user import User


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


@dataclass(frozen=True)
class TenantContext:
    tenant_id: uuid.UUID


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_db)],
    token: Annotated[str, Depends(oauth2_scheme)],
) -> User:
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise AuthError("Token inválido")

    user_id = payload.get("sub")
    if not user_id:
        raise AuthError("Token inválido")

    stmt = select(User, Tenant.is_active).join(Tenant, Tenant.id == User.tenant_id).where(User.id == uuid.UUID(str(user_id)))
    row = (await db.execute(stmt)).first()
    if not row:
        raise AuthError("Token inválido")
    user, tenant_is_active = row
    if not user.is_active or not tenant_is_active:
        raise AuthError("Token inválido")

    # Make actor / tenant available to the audit listener via the sync session.
    db.sync_session.info["actor"] = f"{user.role.value}:{user.email}"
    db.sync_session.info["tenant_id"] = user.tenant_id
    return user


async def get_tenant_context(user: Annotated[User, Depends(get_current_user)]) -> TenantContext:
    return TenantContext(tenant_id=user.tenant_id)


def require_roles(*allowed: UserRole) -> Callable[[User], User]:
    async def _guard(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in allowed:
            raise ForbiddenError("Acesso negado")
        return user

    return _guard


async def require_platform_admin(
    x_platform_admin_key: Annotated[str | None, Header(alias="x-platform-admin-key")] = None,
) -> None:
    """
    Guard for platform-level endpoints (provisioning tenants).

    This is intentionally separate from tenant auth: it is a single key that
    must be kept secret and is meant for the SaaS operator only.
    """
    effective_key = settings.PLATFORM_ADMIN_KEY
    if not effective_key and settings.ENV == "dev":
        # Dev convenience: keep platform endpoints usable locally even if .env isn't configured.
        effective_key = "dev-platform-key"

    if not effective_key:
        raise ForbiddenError("Plataforma não habilitada")
    if not x_platform_admin_key or x_platform_admin_key != effective_key:
        raise ForbiddenError("Acesso negado")
