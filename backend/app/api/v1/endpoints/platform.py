from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy import case, delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.billing_event import BillingEvent
from app.models.client import Client
from app.models.document import Document
from app.models.honorario import Honorario
from app.models.password_reset import PasswordReset
from app.models.parceria import Parceria
from app.models.plan import Plan
from app.models.process import Process
from app.models.subscription import Subscription
from app.models.tenant import Tenant
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.models.enums import UserRole
from app.schemas.platform import (
    PlatformBillingEventOut,
    PlatformResendInviteOut,
    PlatformTenantCreate,
    PlatformTenantCreatedOut,
    PlatformTenantDeletedOut,
    PlatformTenantDetailOut,
    PlatformTenantListItem,
    PlatformTenantStatusOut,
    PlatformTrialTenantCreate,
)
from app.schemas.tenant import TenantOut
from app.schemas.token import TokenPair
from app.schemas.user import UserOut
from app.services.auth_service import AuthService
from app.services.billing_service import BillingService
from app.services.email_service import EmailService
from app.services.plan_limit_service import PlanLimitService
from app.services.platform_service import PlatformService
from app.services.payment_service import get_payment_provider
from app.services.s3_service import S3Service


router = APIRouter()

_auth_service = AuthService(email_service=EmailService(), plan_limit_service=PlanLimitService())
_platform_service = PlatformService(email_service=EmailService())

logger = logging.getLogger(__name__)


@router.get("/tenants", response_model=list[PlatformTenantListItem])
async def list_tenants(
    db: Annotated[AsyncSession, Depends(get_db)],
    q: str | None = None,
    documento: str | None = None,
    admin_email: str | None = None,
    is_active: bool | None = None,
):
    """
    List tenants for the SaaS operator.

    Note: this endpoint is protected by PLATFORM_ADMIN_KEY.
    """
    stmt = select(Tenant).order_by(Tenant.criado_em.desc())

    if is_active is not None:
        stmt = stmt.where(Tenant.is_active.is_(is_active))

    if documento:
        doc = documento.strip()
        if doc:
            stmt = stmt.where(Tenant.documento.ilike(f"%{doc}%"))

    if admin_email:
        email = admin_email.strip()
        if email:
            stmt = stmt.where(
                Tenant.id.in_(
                    select(User.tenant_id)
                    .where(User.role == UserRole.admin)
                    .where(User.email.ilike(f"%{email}%"))
                )
            )

    if q:
        qv = q.strip()
        if qv:
            pattern = f"%{qv}%"
            stmt = stmt.where(
                or_(
                    Tenant.nome.ilike(pattern),
                    Tenant.slug.ilike(pattern),
                    Tenant.documento.ilike(pattern),
                    Tenant.cnpj.ilike(pattern),
                    Tenant.id.in_(select(User.tenant_id).where(User.email.ilike(pattern))),
                )
            )

    tenants = list((await db.execute(stmt)).scalars().all())
    if not tenants:
        return []

    tenant_ids = [t.id for t in tenants]

    # Subscription + plan per tenant (1 row per tenant)
    sub_stmt = (
        select(Subscription, Plan)
        .join(Plan, Plan.code == Subscription.plan_code)
        .where(Subscription.tenant_id.in_(tenant_ids))
    )
    sub_by_tenant: dict[uuid.UUID, tuple[Subscription, Plan]] = {}
    for sub, plan in (await db.execute(sub_stmt)).all():
        sub_by_tenant[sub.tenant_id] = (sub, plan)

    # Oldest admin per tenant (default contact)
    admin_stmt = (
        select(User)
        .where(User.tenant_id.in_(tenant_ids))
        .where(User.role == UserRole.admin)
        .order_by(User.tenant_id.asc(), User.criado_em.asc())
    )
    admin_by_tenant: dict[uuid.UUID, User] = {}
    for u in (await db.execute(admin_stmt)).scalars().all():
        if u.tenant_id not in admin_by_tenant:
            admin_by_tenant[u.tenant_id] = u

    # User counts
    users_stmt = (
        select(
            User.tenant_id,
            func.count(User.id).label("users_total"),
            func.coalesce(func.sum(case((User.is_active.is_(True), 1), else_=0)), 0).label("users_active"),
        )
        .where(User.tenant_id.in_(tenant_ids))
        .group_by(User.tenant_id)
    )
    users_counts: dict[uuid.UUID, tuple[int, int]] = {}
    for tenant_id, total, active in (await db.execute(users_stmt)).all():
        users_counts[tenant_id] = (int(total), int(active))

    # Storage usage (sum of documents)
    storage_stmt = (
        select(Document.tenant_id, func.coalesce(func.sum(Document.size_bytes), 0).label("storage_used"))
        .where(Document.tenant_id.in_(tenant_ids))
        .group_by(Document.tenant_id)
    )
    storage_by_tenant: dict[uuid.UUID, int] = {tid: int(sz) for tid, sz in (await db.execute(storage_stmt)).all()}

    items: list[PlatformTenantListItem] = []
    for t in tenants:
        sub, plan = sub_by_tenant.get(t.id, (None, None))  # type: ignore[assignment]
        admin = admin_by_tenant.get(t.id)
        total_users, active_users = users_counts.get(t.id, (0, 0))
        storage_used = storage_by_tenant.get(t.id, 0)

        items.append(
            PlatformTenantListItem(
                id=t.id,
                nome=t.nome,
                cnpj=t.cnpj,
                tipo_documento=t.tipo_documento.value if hasattr(t.tipo_documento, "value") else str(t.tipo_documento),
                documento=t.documento,
                slug=t.slug,
                criado_em=t.criado_em,
                is_active=t.is_active,
                admin_email=admin.email if admin else None,
                admin_nome=admin.nome if admin else None,
                admin_is_active=admin.is_active if admin else None,
                users_total=total_users,
                users_active=active_users,
                storage_used_bytes=storage_used,
                plan_code=sub.plan_code if sub else None,
                plan_nome=plan.nome if plan else None,
                subscription_status=sub.status if sub else None,
                current_period_end=sub.current_period_end if sub else None,
                grace_period_end=sub.grace_period_end if sub else None,
                provider=sub.provider.value if sub else None,
            )
        )
    return items


@router.get("/tenants/{tenant_id}", response_model=PlatformTenantDetailOut)
async def tenant_detail(
    tenant_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Tenant details for support (includes recent billing events).
    """
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise NotFoundError("Tenant não encontrado")

    admins = (
        await db.execute(
            select(User)
            .where(User.tenant_id == tenant_id)
            .where(User.role == UserRole.admin)
            .order_by(User.criado_em.asc())
        )
    ).scalars().all()

    sub = (await db.execute(select(Subscription).where(Subscription.tenant_id == tenant_id))).scalar_one_or_none()

    events = (
        await db.execute(
            select(BillingEvent)
            .where(BillingEvent.tenant_id == tenant_id)
            .order_by(BillingEvent.criado_em.desc())
            .limit(20)
        )
    ).scalars().all()

    return PlatformTenantDetailOut(
        tenant=TenantOut.model_validate(tenant),
        admin_users=[UserOut.model_validate(u) for u in admins],
        subscription=sub,  # parsed via from_attributes
        billing_events=[PlatformBillingEventOut.model_validate(e) for e in events],
    )


@router.post("/billing/maintenance")
async def billing_maintenance(
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Scheduled billing maintenance (expiration/grace handling + emails).

    This is intentionally under /platform and protected by PLATFORM_ADMIN_KEY
    so a cron job can call it.
    """
    billing = BillingService(provider=get_payment_provider(), email_service=EmailService())
    return await billing.run_scheduled_maintenance(db, background)


@router.post("/tenants", response_model=PlatformTenantCreatedOut)
async def create_tenant(
    payload: PlatformTenantCreate,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Provision a new tenant + admin user.

    This is the operator equivalent of /auth/register-tenant.
    """
    tenant, admin_user, access, refresh = await _auth_service.register_tenant(
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
    return PlatformTenantCreatedOut(
        tenant=TenantOut.model_validate(tenant),
        admin_user=UserOut.model_validate(admin_user),
        tokens=TokenPair(access_token=access, refresh_token=refresh),
    )


@router.post("/tenants/trial", response_model=PlatformTenantCreatedOut)
async def create_trial_tenant(
    payload: PlatformTrialTenantCreate,
    request: Request,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Operator creates a FREE tenant for testing and sends a first-access invite link by email.
    """
    app_base_url = request.headers.get("origin") or f"{request.url.scheme}://{request.headers.get('host')}"
    tenant, admin_user = await _platform_service.create_trial_tenant(
        db,
        background,
        tenant_nome=payload.tenant_nome,
        tenant_tipo_documento=payload.tenant_tipo_documento,
        tenant_documento=payload.tenant_documento,
        tenant_slug=payload.tenant_slug,
        admin_nome=payload.admin_nome,
        admin_email=str(payload.admin_email),
        app_base_url=app_base_url,
    )
    # Tokens are not returned here (first access is via invite link); but keep response shape stable.
    return PlatformTenantCreatedOut(
        tenant=TenantOut.model_validate(tenant),
        admin_user=UserOut.model_validate(admin_user),
        tokens=TokenPair(access_token="", refresh_token=""),
    )


@router.post("/tenants/{tenant_id}/resend-invite", response_model=PlatformResendInviteOut)
async def resend_first_access_invite(
    tenant_id: uuid.UUID,
    request: Request,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Resend the first-access invite link to the tenant admin.

    This is useful when the operator created a trial tenant and the email was not delivered
    or the link expired.
    """
    app_base_url = request.headers.get("origin") or f"{request.url.scheme}://{request.headers.get('host')}"

    # Pick the oldest admin user for the tenant as the default recipient.
    admin_stmt = (
        select(User)
        .where(User.tenant_id == tenant_id)
        .where(User.role == UserRole.admin)
        .order_by(User.criado_em.asc())
        .limit(1)
    )
    admin_user = (await db.execute(admin_stmt)).scalar_one_or_none()
    if not admin_user:
        raise NotFoundError("Admin do tenant não encontrado")

    await _platform_service.resend_first_access(
        db,
        background,
        tenant_id=tenant_id,
        email=admin_user.email,
        nome=admin_user.nome,
        app_base_url=app_base_url,
    )
    return PlatformResendInviteOut(message="Convite reenviado", email=admin_user.email)


@router.post("/tenants/{tenant_id}/deactivate", response_model=PlatformTenantStatusOut)
async def deactivate_tenant(
    tenant_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise NotFoundError("Tenant não encontrado")

    if tenant.is_active:
        tenant.is_active = False
        db.add(tenant)
        await db.commit()

    return PlatformTenantStatusOut(message="Tenant desativado", tenant_id=tenant.id, is_active=tenant.is_active)


@router.post("/tenants/{tenant_id}/activate", response_model=PlatformTenantStatusOut)
async def activate_tenant(
    tenant_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise NotFoundError("Tenant não encontrado")

    if not tenant.is_active:
        tenant.is_active = True
        db.add(tenant)
        await db.commit()

    return PlatformTenantStatusOut(message="Tenant ativado", tenant_id=tenant.id, is_active=tenant.is_active)


@router.delete("/tenants/{tenant_id}", response_model=PlatformTenantDeletedOut)
async def delete_tenant(
    tenant_id: uuid.UUID,
    confirm: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise NotFoundError("Tenant não encontrado")

    if confirm != tenant.slug:
        raise BadRequestError("Confirmação inválida. Envie ?confirm=<slug> para excluir.")

    if tenant.is_active:
        raise ForbiddenError("Desative o tenant antes de excluir.")

    # Collect S3 keys before deleting DB rows (best-effort cleanup after commit).
    keys = [k for (k,) in (await db.execute(select(Document.s3_key).where(Document.tenant_id == tenant_id))).all()]

    # Collect user IDs for dependent cleanup (password resets).
    user_ids = [uid for (uid,) in (await db.execute(select(User.id).where(User.tenant_id == tenant_id))).all()]

    # Break circular FK: honorarios.comprovante_document_id -> documents.id
    await db.execute(
        update(Honorario)
        .where(Honorario.tenant_id == tenant_id)
        .values(comprovante_document_id=None)
    )

    if user_ids:
        await db.execute(delete(PasswordReset).where(PasswordReset.user_id.in_(user_ids)))

    await db.execute(delete(UserInvitation).where(UserInvitation.tenant_id == tenant_id))

    # Business modules
    from app.models.agenda_evento import AgendaEvento  # local import to avoid circulars
    from app.models.tarefa import Tarefa  # local import to avoid circulars

    await db.execute(delete(Tarefa).where(Tarefa.tenant_id == tenant_id))
    await db.execute(delete(AgendaEvento).where(AgendaEvento.tenant_id == tenant_id))

    await db.execute(delete(Document).where(Document.tenant_id == tenant_id))
    await db.execute(delete(Honorario).where(Honorario.tenant_id == tenant_id))
    await db.execute(delete(Process).where(Process.tenant_id == tenant_id))
    await db.execute(delete(Parceria).where(Parceria.tenant_id == tenant_id))
    await db.execute(delete(Client).where(Client.tenant_id == tenant_id))
    await db.execute(delete(Subscription).where(Subscription.tenant_id == tenant_id))
    await db.execute(delete(User).where(User.tenant_id == tenant_id))
    await db.execute(delete(AuditLog).where(AuditLog.tenant_id == tenant_id))
    await db.execute(delete(Tenant).where(Tenant.id == tenant_id))

    await db.commit()

    # Best-effort S3 cleanup (do not fail the request if storage is unavailable).
    s3 = S3Service()
    for key in keys:
        try:
            s3.delete_object(key=key)
        except Exception as exc:  # noqa: BLE001
            logger.warning("S3 delete failed for key=%s: %s", key, exc)

    return PlatformTenantDeletedOut(message="Tenant excluído", tenant_id=tenant_id)
