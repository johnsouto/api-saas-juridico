from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AuthError, BadRequestError, NotFoundError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.enums import BillingProvider, PlanCode, SubscriptionStatus, TenantDocumentoTipo, UserRole
from app.models.password_reset import PasswordReset
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.tenant import Tenant
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.services.email_service import EmailService
from app.services.plan_limit_service import PlanLimitService
from app.utils.crypto import sha256_hex
from app.utils.slug import normalize_slug
from app.utils.validators import is_disposable_email, is_valid_cnpj, is_valid_cpf, only_digits


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class AuthService:
    email_service: EmailService
    plan_limit_service: PlanLimitService

    async def authenticate(self, db: AsyncSession, *, email: str, password: str) -> tuple[User, str, str]:
        stmt = select(User, Tenant.is_active).join(Tenant, Tenant.id == User.tenant_id).where(User.email == email)
        row = (await db.execute(stmt)).first()
        if not row:
            raise AuthError("Credenciais inválidas")
        user, tenant_is_active = row
        if not user.is_active:
            raise AuthError("Credenciais inválidas")
        if not verify_password(password, user.senha_hash):
            raise AuthError("Credenciais inválidas")
        if not tenant_is_active:
            raise AuthError("Escritório desativado")

        access = create_access_token(subject=str(user.id), tenant_id=str(user.tenant_id), role=user.role.value)
        refresh = create_refresh_token(subject=str(user.id), tenant_id=str(user.tenant_id), role=user.role.value)
        return user, access, refresh

    async def refresh(self, db: AsyncSession, *, refresh_token: str) -> tuple[str, str]:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise AuthError("Refresh token inválido")

        user_id = payload.get("sub")
        stmt = select(User, Tenant.is_active).join(Tenant, Tenant.id == User.tenant_id).where(User.id == uuid.UUID(user_id))
        row = (await db.execute(stmt)).first()
        if not row:
            raise AuthError("Usuário inválido")
        user, tenant_is_active = row
        if not user.is_active or not tenant_is_active:
            raise AuthError("Usuário inválido")

        access = create_access_token(subject=str(user.id), tenant_id=str(user.tenant_id), role=user.role.value)
        refresh = create_refresh_token(subject=str(user.id), tenant_id=str(user.tenant_id), role=user.role.value)
        return access, refresh

    async def register_tenant(
        self,
        db: AsyncSession,
        background: BackgroundTasks,
        *,
        tenant_nome: str,
        tenant_tipo_documento: TenantDocumentoTipo,
        tenant_documento: str,
        tenant_slug: str,
        admin_nome: str,
        admin_email: str,
        admin_senha: str,
    ) -> tuple[Tenant, User, str, str]:
        tenant_slug = normalize_slug(tenant_slug)
        tenant_documento = only_digits(tenant_documento)
        admin_email = admin_email.strip().lower()

        if not tenant_documento:
            raise BadRequestError("Documento é obrigatório")

        if tenant_tipo_documento == TenantDocumentoTipo.cpf:
            if not is_valid_cpf(tenant_documento):
                raise BadRequestError("CPF inválido")
        else:
            if not is_valid_cnpj(tenant_documento):
                raise BadRequestError("CNPJ inválido")

        if is_disposable_email(admin_email):
            raise BadRequestError("Email descartável não é permitido. Use um email real (Gmail/corporativo).")

        plan_stmt = select(Plan).where(Plan.code == PlanCode.FREE)
        free_plan = (await db.execute(plan_stmt)).scalar_one_or_none()
        if not free_plan:
            raise NotFoundError("Plano Free não encontrado. Rode o seed.")

        tenant = Tenant(
            nome=tenant_nome,
            cnpj=tenant_documento if tenant_tipo_documento == TenantDocumentoTipo.cnpj else None,
            tipo_documento=tenant_tipo_documento,
            documento=tenant_documento,
            slug=tenant_slug,
        )
        db.add(tenant)
        await db.flush()  # allocate tenant.id before using it

        admin = User(
            tenant_id=tenant.id,
            nome=admin_nome,
            email=admin_email,
            senha_hash=hash_password(admin_senha),
            role=UserRole.admin,
        )
        sub = Subscription(
            tenant_id=tenant.id,
            plan_code=free_plan.code,
            status=SubscriptionStatus.free,
            provider=BillingProvider.FAKE,
            current_period_start=None,
            current_period_end=None,
            grace_period_end=None,
            cancel_at_period_end=False,
            last_payment_at=None,
            last_payment_status=None,
        )

        db.add_all([admin, sub])

        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise BadRequestError("Não foi possível registrar: documento, slug ou email já cadastrado.") from exc

        await db.refresh(tenant)
        await db.refresh(admin)

        self.email_service.send_welcome_email(background, to_email=admin_email, tenant_nome=tenant_nome)

        access = create_access_token(subject=str(admin.id), tenant_id=str(admin.tenant_id), role=admin.role.value)
        refresh = create_refresh_token(subject=str(admin.id), tenant_id=str(admin.tenant_id), role=admin.role.value)
        return tenant, admin, access, refresh

    async def invite_user(
        self,
        db: AsyncSession,
        background: BackgroundTasks,
        *,
        inviter: User,
        tenant_id: uuid.UUID,
        nome: str,
        email: str,
        role: UserRole,
        app_base_url: str,
    ) -> None:
        await self.plan_limit_service.enforce_user_limit(db, tenant_id=tenant_id)

        raw_token = secrets.token_urlsafe(32)
        inv = UserInvitation(
            tenant_id=tenant_id,
            nome=nome,
            email=email,
            role=role,
            token_hash=sha256_hex(raw_token),
            expires_at=_utcnow() + timedelta(days=3),
            accepted_at=None,
        )

        db.add(inv)
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise AuthError("Convite não pôde ser criado (email já convidado ou já cadastrado).") from exc

        invite_link = f"{app_base_url.rstrip('/')}/accept-invite?token={raw_token}"
        self.email_service.send_invite_email(background, to_email=email, inviter_name=inviter.nome, invite_link=invite_link)

    async def accept_invite(self, db: AsyncSession, *, token: str, password: str) -> tuple[User, str, str]:
        token_hash = sha256_hex(token)
        stmt = select(UserInvitation).where(UserInvitation.token_hash == token_hash)
        inv = (await db.execute(stmt)).scalar_one_or_none()
        if not inv:
            raise AuthError("Convite inválido")
        if inv.accepted_at is not None:
            raise AuthError("Convite já utilizado")
        if inv.expires_at < _utcnow():
            raise AuthError("Convite expirado")

        tenant_active = (await db.execute(select(Tenant.is_active).where(Tenant.id == inv.tenant_id))).scalar_one_or_none()
        if tenant_active is False:
            raise AuthError("Escritório desativado")
        if tenant_active is None:
            raise AuthError("Convite inválido")

        # Enforce plan limit again at accept time (race-safe).
        await self.plan_limit_service.enforce_user_limit(db, tenant_id=inv.tenant_id)

        # If a platform operator pre-created the user as inactive (first-access flow),
        # we "activate" that user here. Otherwise, we create a new one.
        existing_stmt = select(User).where(User.email == inv.email)
        user = (await db.execute(existing_stmt)).scalar_one_or_none()
        if user:
            if user.tenant_id != inv.tenant_id:
                raise AuthError("Convite inválido")
            if user.is_active:
                raise AuthError("Usuário já está ativo")
            user.nome = inv.nome
            user.role = inv.role
            user.senha_hash = hash_password(password)
            user.is_active = True
            db.add(user)
        else:
            user = User(
                tenant_id=inv.tenant_id,
                nome=inv.nome,
                email=inv.email,
                senha_hash=hash_password(password),
                role=inv.role,
            )

        inv.accepted_at = _utcnow()
        db.add(user)
        db.add(inv)

        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise AuthError("Não foi possível aceitar o convite (email já cadastrado).") from exc

        await db.refresh(user)
        access = create_access_token(subject=str(user.id), tenant_id=str(user.tenant_id), role=user.role.value)
        refresh = create_refresh_token(subject=str(user.id), tenant_id=str(user.tenant_id), role=user.role.value)
        return user, access, refresh

    async def request_password_reset(
        self,
        db: AsyncSession,
        background: BackgroundTasks,
        *,
        email: str,
        app_base_url: str,
    ) -> None:
        stmt = select(User, Tenant.is_active).join(Tenant, Tenant.id == User.tenant_id).where(User.email == email)
        row = (await db.execute(stmt)).first()
        if not row:
            return
        user, tenant_is_active = row
        if not user.is_active or not tenant_is_active:
            # Intentionally do not reveal whether the email exists.
            return

        raw_token = secrets.token_urlsafe(32)
        pr = PasswordReset(
            user_id=user.id,
            token_hash=sha256_hex(raw_token),
            expires_at=_utcnow() + timedelta(hours=2),
            used_at=None,
        )
        db.add(pr)
        await db.commit()

        reset_link = f"{app_base_url.rstrip('/')}/reset-password?token={raw_token}"
        self.email_service.send_reset_password_email(background, to_email=email, reset_link=reset_link)

    async def confirm_password_reset(self, db: AsyncSession, *, token: str, new_password: str) -> None:
        token_hash = sha256_hex(token)
        stmt = select(PasswordReset).where(PasswordReset.token_hash == token_hash)
        pr = (await db.execute(stmt)).scalar_one_or_none()
        if not pr:
            raise AuthError("Token inválido")
        if pr.used_at is not None:
            raise AuthError("Token já utilizado")
        if pr.expires_at < _utcnow():
            raise AuthError("Token expirado")

        user_stmt = select(User).where(User.id == pr.user_id)
        user = (await db.execute(user_stmt)).scalar_one_or_none()
        if not user:
            raise AuthError("Usuário não encontrado")

        user.senha_hash = hash_password(new_password)
        pr.used_at = _utcnow()

        db.add(user)
        db.add(pr)
        await db.commit()
