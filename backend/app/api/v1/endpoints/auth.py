from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.auth import (
    AcceptInviteRequest,
    InviteUserRequest,
    ResetPasswordConfirm,
    ResetPasswordRequest,
    TenantRegisterRequest,
)
from app.schemas.token import RefreshRequest, TokenPair
from app.schemas.user import UserOut
from app.services.auth_service import AuthService
from app.services.email_service import EmailService
from app.services.plan_limit_service import PlanLimitService


router = APIRouter()

_auth_service = AuthService(email_service=EmailService(), plan_limit_service=PlanLimitService())


def _app_base_url(request: Request) -> str:
    origin = request.headers.get("origin")
    if origin:
        return origin
    host = request.headers.get("host")
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    return f"{scheme}://{host}"


@router.post("/register-tenant", response_model=TokenPair)
async def register_tenant(
    payload: TenantRegisterRequest,
    request: Request,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _, __, access, refresh = await _auth_service.register_tenant(
        db,
        background,
        tenant_nome=payload.tenant_nome,
        tenant_tipo_documento=payload.tenant_tipo_documento,
        tenant_documento=payload.tenant_documento,
        tenant_slug=payload.tenant_slug,
        admin_nome=payload.admin_nome,
        admin_email=str(payload.admin_email),
        admin_senha=payload.admin_senha,
    )
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/login", response_model=TokenPair)
async def login(
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # OAuth2PasswordRequestForm uses "username" - we treat it as email.
    _, access, refresh = await _auth_service.authenticate(db, email=form.username, password=form.password)
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/refresh", response_model=TokenPair)
async def refresh(payload: RefreshRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    access, refresh_token = await _auth_service.refresh(db, refresh_token=payload.refresh_token)
    return TokenPair(access_token=access, refresh_token=refresh_token)


@router.get("/me", response_model=UserOut)
async def me(user: Annotated[User, Depends(get_current_user)]):
    return user


@router.post("/invite")
async def invite_user(
    payload: InviteUserRequest,
    request: Request,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    inviter: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    await _auth_service.invite_user(
        db,
        background,
        inviter=inviter,
        tenant_id=inviter.tenant_id,
        nome=payload.nome,
        email=str(payload.email),
        role=payload.role,
        app_base_url=_app_base_url(request),
    )
    return {"message": "Convite enviado"}


@router.post("/accept-invite", response_model=TokenPair)
async def accept_invite(payload: AcceptInviteRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    _, access, refresh = await _auth_service.accept_invite(db, token=payload.token, password=payload.senha)
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest, request: Request, background: BackgroundTasks, db: Annotated[AsyncSession, Depends(get_db)]):
    await _auth_service.request_password_reset(
        db,
        background,
        email=str(payload.email),
        app_base_url=_app_base_url(request),
    )
    return {"message": "Se o email existir, enviaremos instruções"}


@router.post("/reset-password/confirm")
async def reset_password_confirm(payload: ResetPasswordConfirm, db: Annotated[AsyncSession, Depends(get_db)]):
    await _auth_service.confirm_password_reset(db, token=payload.token, new_password=payload.nova_senha)
    return {"message": "Senha atualizada"}
