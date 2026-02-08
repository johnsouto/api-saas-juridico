from __future__ import annotations

import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, NotFoundError
from app.core.security import hash_password
from app.models.enums import BillingProvider, PlanCode, SubscriptionStatus, TenantDocumentoTipo, UserRole
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.tenant import Tenant
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.services.email_service import EmailService
from app.utils.crypto import sha256_hex
from app.utils.slug import normalize_slug


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class PlatformService:
    email_service: EmailService

    async def create_trial_tenant(
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
        app_base_url: str,
    ) -> tuple[Tenant, User]:
        """
        Create a tenant + FREE subscription + inactive admin user, then send a first-access link.

        The admin user is created with `is_active=False` to reserve the email (users.email is unique),
        and will become active when they accept the invite and set a password.
        """
        tenant_slug = normalize_slug(tenant_slug)

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
        await db.flush()

        # Create user with a random password (won't be used); they'll set a real one via invite link.
        random_pw = secrets.token_urlsafe(16)
        admin = User(
            tenant_id=tenant.id,
            nome=admin_nome,
            email=admin_email,
            senha_hash=hash_password(random_pw),
            role=UserRole.admin,
            is_active=False,
        )
        db.add(admin)
        await db.flush()

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
        db.add(sub)

        # Create invitation token for first access.
        raw_token = secrets.token_urlsafe(32)
        inv = UserInvitation(
            tenant_id=tenant.id,
            nome=admin_nome,
            email=admin_email,
            role=UserRole.admin,
            token_hash=sha256_hex(raw_token),
            expires_at=_utcnow() + timedelta(days=7),
            accepted_at=None,
        )
        db.add(inv)

        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise BadRequestError("Não foi possível criar o tenant (documento/slug/email já existe).") from exc

        invite_link = f"{app_base_url.rstrip('/')}/accept-invite?token={raw_token}"
        self.email_service.send_first_access_email(background, to_email=admin_email, tenant_nome=tenant_nome, invite_link=invite_link)

        await db.refresh(tenant)
        await db.refresh(admin)
        return tenant, admin

    async def resend_first_access(
        self,
        db: AsyncSession,
        background: BackgroundTasks,
        *,
        tenant_id: uuid.UUID,
        email: str,
        nome: str,
        app_base_url: str,
    ) -> None:
        stmt = select(Tenant).where(Tenant.id == tenant_id)
        tenant = (await db.execute(stmt)).scalar_one_or_none()
        if not tenant:
            raise NotFoundError("Tenant não encontrado")

        # If there is a pending invite for the same tenant/email, rotate its token instead of creating a new row.
        # This avoids the unique constraint (tenant_id, email) and provides a true "resend" behavior.
        pending_stmt = (
            select(UserInvitation)
            .where(UserInvitation.tenant_id == tenant_id)
            .where(UserInvitation.email == email)
            .where(UserInvitation.accepted_at.is_(None))
        )
        inv = (await db.execute(pending_stmt)).scalar_one_or_none()

        raw_token = secrets.token_urlsafe(32)
        token_hash = sha256_hex(raw_token)

        if inv:
            inv.nome = nome
            inv.role = UserRole.admin
            inv.token_hash = token_hash
            inv.expires_at = _utcnow() + timedelta(days=7)
            db.add(inv)
        else:
            inv = UserInvitation(
                tenant_id=tenant_id,
                nome=nome,
                email=email,
                role=UserRole.admin,
                token_hash=token_hash,
                expires_at=_utcnow() + timedelta(days=7),
                accepted_at=None,
            )
            db.add(inv)

        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise BadRequestError("Convite não pôde ser criado (email já convidado ou já cadastrado).") from exc

        invite_link = f"{app_base_url.rstrip('/')}/accept-invite?token={raw_token}"
        self.email_service.send_first_access_email(background, to_email=email, tenant_nome=tenant.nome, invite_link=invite_link)
