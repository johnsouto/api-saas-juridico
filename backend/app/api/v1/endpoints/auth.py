from __future__ import annotations

import asyncio
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.config import settings
from app.core.exceptions import AuthError, BadRequestError
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
from app.schemas.token import RefreshRequest
from app.schemas.user import UserOut
from app.services.auth_service import AuthService
from app.services.auth_security_service import AuthSecurityService
from app.services.email_service import EmailService
from app.services.plan_limit_service import PlanLimitService
from app.services.telegram_service import send_telegram_alert
from app.services.turnstile_service import verify_turnstile
from app.utils.validators import only_digits


router = APIRouter()

_auth_service = AuthService(email_service=EmailService(), plan_limit_service=PlanLimitService())
_auth_security = AuthSecurityService()

ACCESS_COOKIE_NAME = "saas_access"
REFRESH_COOKIE_NAME = "saas_refresh"


def _app_base_url(request: Request) -> str:
    origin = request.headers.get("origin")
    if origin:
        return origin
    host = request.headers.get("host")
    scheme = request.headers.get("x-forwarded-proto", request.url.scheme)
    return f"{scheme}://{host}"


def _client_ip(request: Request) -> str | None:
    """
    Best-effort client IP extraction.

    NOTE: In production we sit behind Traefik, so prefer X-Forwarded-For.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        return first or None
    if request.client:
        return request.client.host
    return None


def _tg_code(value: str | None) -> str:
    """
    Wrap dynamic values as inline code for Telegram Markdown, avoiding formatting breakage.
    """
    s = (value or "").strip().replace("`", "'")
    return f"`{s}`" if s else "`-`"


def _notify_telegram_async(message: str) -> None:
    """
    Fire-and-forget Telegram alert.

    Must never block or break the request flow.
    """
    try:
        asyncio.create_task(send_telegram_alert(message))
    except Exception:
        # Best-effort only.
        return


def _set_auth_cookies(*, response: JSONResponse, access_token: str, refresh_token: str) -> None:
    """
    Emit auth cookies for the browser (same-origin).

    - saas_access: short-lived, sent to all paths.
    - saas_refresh: long-lived, scoped to the refresh endpoint only.
    """
    secure = settings.ENV == "prod"
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/v1/auth/refresh",
    )


def _clear_auth_cookies(*, response: JSONResponse) -> None:
    secure = settings.ENV == "prod"
    # Important: use the same Path values used when setting cookies.
    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value="",
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=0,
        expires=0,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value="",
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=0,
        expires=0,
        path="/api/v1/auth/refresh",
    )


@router.post("/register-tenant")
async def register_tenant(
    payload: TenantRegisterRequest,
    request: Request,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _auth_security.enforce_rate_limit(
        request=request,
        action="register-tenant",
        principal=str(payload.admin_email),
    )

    # Anti-bot protection (optional; enabled when TURNSTILE_SECRET_KEY is set).
    attempted_doc = only_digits(payload.tenant_documento)
    attempted_email = str(payload.admin_email).strip().lower()
    if settings.TURNSTILE_SECRET_KEY:
        if not payload.cf_turnstile_response:
            _notify_telegram_async(
                "\n".join(
                    [
                        "⚠️ *Tentativa de Cadastro Barrada*",
                        f"• *Nome:* {_tg_code(payload.tenant_nome)}",
                        f"• *Doc Tentado:* {_tg_code(attempted_doc)}",
                        f"• *Motivo:* {_tg_code('Captcha obrigatório')}",
                    ]
                )
            )
            raise HTTPException(status_code=403, detail="Verificação anti-robô obrigatória")
        result = await verify_turnstile(payload.cf_turnstile_response, remoteip=_client_ip(request))
        if not result.success:
            _notify_telegram_async(
                "\n".join(
                    [
                        "⚠️ *Tentativa de Cadastro Barrada*",
                        f"• *Nome:* {_tg_code(payload.tenant_nome)}",
                        f"• *Doc Tentado:* {_tg_code(attempted_doc)}",
                        f"• *Motivo:* {_tg_code('Captcha inválido')}",
                    ]
                )
            )
            raise HTTPException(status_code=403, detail="Falha na verificação anti-robô. Tente novamente.")

    try:
        tenant, __, access, refresh = await _auth_service.register_tenant(
            db,
            background,
            tenant_nome=payload.tenant_nome,
            tenant_tipo_documento=payload.tenant_tipo_documento,
            tenant_documento=payload.tenant_documento,
            tenant_slug=payload.tenant_slug,
            admin_email=attempted_email,
            admin_senha=payload.admin_senha,
            admin_first_name=payload.first_name,
            admin_last_name=payload.last_name,
        )
    except BadRequestError as exc:
        reason = str(exc)
        if reason in {"CPF inválido", "CNPJ inválido"}:
            _notify_telegram_async(
                "\n".join(
                    [
                        "⚠️ *Tentativa de Cadastro Barrada*",
                        f"• *Nome:* {_tg_code(payload.tenant_nome)}",
                        f"• *Doc Tentado:* {_tg_code(attempted_doc)}",
                        f"• *Motivo:* {_tg_code(reason)}",
                    ]
                )
            )
        raise

    # Success alert (best-effort)
    _notify_telegram_async(
        "\n".join(
            [
                "✅ *Novo Cadastro no Elemento Juris*",
                f"• *Nome:* {_tg_code(tenant.nome)}",
                f"• *Doc:* {_tg_code(tenant.documento)}",
                f"• *E-mail:* {_tg_code(attempted_email)}",
                "• *Status:* Turnstile Validado",
            ]
        )
    )

    response = JSONResponse({"ok": True})
    _set_auth_cookies(response=response, access_token=access, refresh_token=refresh)
    return response


@router.post("/login")
async def login(
    request: Request,
    form: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # OAuth2PasswordRequestForm uses "username" - we treat it as email.
    principal = form.username.strip().lower()
    _auth_security.enforce_rate_limit(request=request, action="login", principal=principal)
    _auth_security.enforce_login_lockout(request=request, email=principal)

    try:
        _, access, refresh = await _auth_service.authenticate(db, email=principal, password=form.password)
    except AuthError as exc:
        _auth_security.record_login_failure(request=request, email=principal)
        # Generic external message to avoid account enumeration.
        raise HTTPException(status_code=401, detail="Credenciais inválidas.") from exc

    _auth_security.record_login_success(request=request, email=principal)
    response = JSONResponse({"ok": True})
    _set_auth_cookies(response=response, access_token=access, refresh_token=refresh)
    return response


@router.post("/refresh")
async def refresh(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    payload: RefreshRequest | None = None,
):
    # Prefer HttpOnly cookie; keep payload as a fallback for compatibility.
    refresh_cookie = request.cookies.get(REFRESH_COOKIE_NAME)
    raw_refresh = refresh_cookie or (payload.refresh_token if payload else None)
    if not raw_refresh:
        raise AuthError("Refresh token ausente")

    access, refresh_token = await _auth_service.refresh(db, refresh_token=raw_refresh)
    response = JSONResponse({"ok": True})
    _set_auth_cookies(response=response, access_token=access, refresh_token=refresh_token)
    return response


@router.post("/logout")
async def logout():
    response = JSONResponse({"ok": True})
    _clear_auth_cookies(response=response)
    return response


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


@router.post("/accept-invite")
async def accept_invite(payload: AcceptInviteRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    _, access, refresh = await _auth_service.accept_invite(db, token=payload.token, password=payload.senha)
    response = JSONResponse({"ok": True})
    _set_auth_cookies(response=response, access_token=access, refresh_token=refresh)
    return response


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
