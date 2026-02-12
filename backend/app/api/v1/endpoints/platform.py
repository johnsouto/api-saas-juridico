from __future__ import annotations

import calendar
import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy import String, case, cast, delete, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.billing_event import BillingEvent
from app.models.client import Client
from app.models.document import Document
from app.models.enums import BillingProvider, PlanCode, SubscriptionStatus, UserRole
from app.models.honorario import Honorario
from app.models.password_reset import PasswordReset
from app.models.parceria import Parceria
from app.models.plan import Plan
from app.models.platform_audit_log import PlatformAuditLog
from app.models.process import Process
from app.models.subscription import Subscription
from app.models.tenant import Tenant
from app.models.user import User
from app.models.user_invitation import UserInvitation
from app.schemas.platform import (
    PlatformAuditLogOut,
    PlatformBillingEventOut,
    PlatformOverviewOut,
    PlatformOverviewRecentTenant,
    PlatformOverviewTopTenant,
    PlatformPingOut,
    PlatformRevenueMonthlyPoint,
    PlatformRevenueOverviewOut,
    PlatformRevenueTenantOut,
    PlatformResendInviteOut,
    PlatformTenantStorageOut,
    PlatformTenantCreate,
    PlatformTenantCreatedOut,
    PlatformTenantDeletedOut,
    PlatformTenantDetailOut,
    PlatformTenantLimitsOut,
    PlatformTenantLimitsUpdate,
    PlatformTenantListItem,
    PlatformTenantSubscriptionOut,
    PlatformTenantSubscriptionUpdate,
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
PLUS_MONTHLY_PRICE_FALLBACK_BRL = 47.0


def _to_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _month_bounds_utc(year: int, month: int) -> tuple[datetime, datetime]:
    _, month_last_day = calendar.monthrange(year, month)
    start = datetime(year, month, 1, tzinfo=timezone.utc)
    end = datetime(year, month, month_last_day, 23, 59, 59, 999999, tzinfo=timezone.utc)
    return start, end


def _rolling_months(reference_year: int, reference_month: int, total: int = 12) -> list[tuple[int, int]]:
    months: list[tuple[int, int]] = []
    year = reference_year
    month = reference_month
    for _ in range(total):
        months.append((year, month))
        month -= 1
        if month < 1:
            month = 12
            year -= 1
    months.reverse()
    return months


def _is_active_plus_monthly(subscription: Subscription) -> bool:
    return subscription.plan_code == PlanCode.PLUS_MONTHLY_CARD and subscription.status == SubscriptionStatus.active


def _is_active_now(subscription: Subscription, reference_now: datetime) -> bool:
    if not _is_active_plus_monthly(subscription):
        return False
    starts_at = _to_utc(subscription.current_period_start) or _to_utc(subscription.criado_em)
    ends_at = _to_utc(subscription.current_period_end)
    if starts_at and starts_at > reference_now:
        return False
    if ends_at and ends_at < reference_now:
        return False
    return True


def _is_active_in_month(subscription: Subscription, month_start: datetime, month_end: datetime) -> bool:
    if not _is_active_plus_monthly(subscription):
        return False
    starts_at = _to_utc(subscription.current_period_start) or _to_utc(subscription.criado_em)
    ends_at = _to_utc(subscription.current_period_end)
    if starts_at and starts_at > month_end:
        return False
    if ends_at and ends_at < month_start:
        return False
    return True


async def _plus_monthly_price_brl(db: AsyncSession) -> float:
    row = (
        await db.execute(
            select(
                Plan.price_cents,
                Plan.price,
            ).where(Plan.code == PlanCode.PLUS_MONTHLY_CARD)
        )
    ).first()
    if not row:
        return PLUS_MONTHLY_PRICE_FALLBACK_BRL

    price_cents = int(row[0] or 0)
    legacy_price = row[1]
    if price_cents > 0:
        return round(price_cents / 100, 2)
    if legacy_price is not None:
        return round(float(legacy_price), 2)
    return PLUS_MONTHLY_PRICE_FALLBACK_BRL


def _normalize_subscription_status(raw: str | None) -> SubscriptionStatus | None:
    if not raw:
        return None
    value = raw.strip().lower()
    mapping = {
        "free": SubscriptionStatus.free,
        "active": SubscriptionStatus.active,
        "past_due": SubscriptionStatus.past_due,
        "expired": SubscriptionStatus.expired,
        "canceled": SubscriptionStatus.canceled,
        "trialing": SubscriptionStatus.trialing,
    }
    return mapping.get(value)


def _normalize_plan_code(raw: str | PlanCode | None) -> PlanCode | None:
    if raw is None:
        return None
    if isinstance(raw, PlanCode):
        return raw

    value = str(raw).strip().upper()
    mapping = {
        "FREE": PlanCode.FREE,
        "PLUS_MONTHLY_CARD": PlanCode.PLUS_MONTHLY_CARD,
        "PLUS_ANNUAL_PIX": PlanCode.PLUS_ANNUAL_PIX,
    }
    return mapping.get(value)


def _matches_plan_filter(plan_code: PlanCode | None, plan_filter: str | None) -> bool:
    if not plan_filter:
        return True
    value = plan_filter.strip().upper()
    code = plan_code or PlanCode.FREE
    if value == "PLUS":
        return code in {PlanCode.PLUS_ANNUAL_PIX, PlanCode.PLUS_MONTHLY_CARD}
    if value == "FREE":
        return code == PlanCode.FREE
    return str(code.value if hasattr(code, "value") else code) == value


def _storage_limit_bytes(sub: Subscription | None, plan: Plan | None) -> int | None:
    limit_mb: int | None = None
    if sub and sub.max_storage_mb_override is not None:
        limit_mb = sub.max_storage_mb_override
    elif plan:
        limit_mb = plan.max_storage_mb
    return limit_mb * 1024 * 1024 if limit_mb is not None else None


def _storage_limit_bytes_from_values(override_mb: int | None, plan_mb: int | None) -> int | None:
    limit_mb = override_mb if override_mb is not None else plan_mb
    return limit_mb * 1024 * 1024 if limit_mb is not None else None


async def _log_platform_action(
    db: AsyncSession,
    *,
    action: str,
    tenant_id: uuid.UUID | None = None,
    payload: dict | None = None,
) -> None:
    db.add(PlatformAuditLog(action=action, tenant_id=tenant_id, payload=payload or {}))


@router.get("/ping", response_model=PlatformPingOut)
async def ping_platform() -> PlatformPingOut:
    return PlatformPingOut(ok=True, message="Chave válida")


@router.get("/tenants", response_model=list[PlatformTenantListItem])
async def list_tenants(
    db: Annotated[AsyncSession, Depends(get_db)],
    search: str | None = None,
    plan: str | None = None,
    status: str | None = None,
    storage_gt: int | None = None,
    limit: int = 50,
    offset: int = 0,
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

    search_value = search if search is not None else q
    if search_value:
        qv = search_value.strip()
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
        select(
            Subscription.tenant_id,
            cast(Subscription.plan_code, String).label("plan_code_raw"),
            cast(Subscription.status, String).label("status_raw"),
            Subscription.current_period_end,
            Subscription.grace_period_end,
            cast(Subscription.provider, String).label("provider_raw"),
            Subscription.max_clients_override,
            Subscription.max_storage_mb_override,
            Plan.nome.label("plan_nome"),
            Plan.max_storage_mb.label("plan_max_storage_mb"),
        )
        .join(Plan, Plan.code == Subscription.plan_code, isouter=True)
        .where(Subscription.tenant_id.in_(tenant_ids))
    )
    sub_by_tenant: dict[uuid.UUID, dict] = {}
    for row in (await db.execute(sub_stmt)).all():
        sub_by_tenant[row.tenant_id] = {
            "plan_code": _normalize_plan_code(row.plan_code_raw),
            "status": _normalize_subscription_status(row.status_raw),
            "current_period_end": row.current_period_end,
            "grace_period_end": row.grace_period_end,
            "provider": row.provider_raw,
            "max_clients_override": row.max_clients_override,
            "max_storage_mb_override": row.max_storage_mb_override,
            "plan_nome": row.plan_nome,
            "plan_max_storage_mb": row.plan_max_storage_mb,
        }

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

    clients_stmt = (
        select(Client.tenant_id, func.count(Client.id).label("clients_total"))
        .where(Client.tenant_id.in_(tenant_ids))
        .group_by(Client.tenant_id)
    )
    clients_counts: dict[uuid.UUID, int] = {tid: int(total) for tid, total in (await db.execute(clients_stmt)).all()}

    processes_stmt = (
        select(Process.tenant_id, func.count(Process.id).label("processes_total"))
        .where(Process.tenant_id.in_(tenant_ids))
        .group_by(Process.tenant_id)
    )
    processes_counts: dict[uuid.UUID, int] = {tid: int(total) for tid, total in (await db.execute(processes_stmt)).all()}

    # Storage usage (sum of documents)
    storage_stmt = (
        select(Document.tenant_id, func.coalesce(func.sum(Document.size_bytes), 0).label("storage_used"))
        .where(Document.tenant_id.in_(tenant_ids))
        .group_by(Document.tenant_id)
    )
    storage_by_tenant: dict[uuid.UUID, int] = {tid: int(sz) for tid, sz in (await db.execute(storage_stmt)).all()}

    items: list[PlatformTenantListItem] = []
    for t in tenants:
        sub_info = sub_by_tenant.get(t.id, {})
        admin = admin_by_tenant.get(t.id)
        total_users, active_users = users_counts.get(t.id, (0, 0))
        storage_used = storage_by_tenant.get(t.id, 0)
        clients_total = clients_counts.get(t.id, 0)
        processes_total = processes_counts.get(t.id, 0)
        storage_limit = _storage_limit_bytes_from_values(
            sub_info.get("max_storage_mb_override"),
            sub_info.get("plan_max_storage_mb"),
        )
        storage_percent = round((storage_used / storage_limit) * 100, 2) if storage_limit and storage_limit > 0 else None

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
                clients_total=clients_total,
                processes_total=processes_total,
                storage_used_bytes=storage_used,
                storage_limit_bytes=storage_limit,
                storage_percent_used=storage_percent,
                plan_code=sub_info.get("plan_code"),
                plan_nome=sub_info.get("plan_nome"),
                subscription_status=sub_info.get("status"),
                current_period_end=sub_info.get("current_period_end"),
                grace_period_end=sub_info.get("grace_period_end"),
                provider=sub_info.get("provider"),
                max_clients_override=sub_info.get("max_clients_override"),
                max_storage_mb_override=sub_info.get("max_storage_mb_override"),
            )
        )

    if plan:
        items = [item for item in items if _matches_plan_filter(item.plan_code, plan)]

    normalized_status = _normalize_subscription_status(status)
    if status and not normalized_status:
        return []
    if normalized_status:
        items = [item for item in items if item.subscription_status == normalized_status]

    if storage_gt is not None:
        items = [item for item in items if (item.storage_percent_used or 0) >= storage_gt]

    safe_offset = max(0, int(offset))
    safe_limit = max(1, min(int(limit), 200))
    return items[safe_offset : safe_offset + safe_limit]


@router.get("/metrics/overview", response_model=PlatformOverviewOut)
async def platform_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tenants_total = int((await db.execute(select(func.count(Tenant.id)))).scalar_one() or 0)
    users_total = int((await db.execute(select(func.count(User.id)))).scalar_one() or 0)

    sub_rows = (
        await db.execute(select(Subscription.tenant_id, Subscription.plan_code))
    ).all()
    sub_by_tenant = {tenant_id: plan_code for tenant_id, plan_code in sub_rows}

    all_tenants = (await db.execute(select(Tenant.id, Tenant.nome, Tenant.slug, Tenant.criado_em))).all()

    tenants_free = 0
    tenants_plus = 0
    for tenant_id, *_ in all_tenants:
        plan_code = sub_by_tenant.get(tenant_id, PlanCode.FREE)
        if plan_code in {PlanCode.PLUS_MONTHLY_CARD, PlanCode.PLUS_ANNUAL_PIX}:
            tenants_plus += 1
        else:
            tenants_free += 1

    storage_used_bytes_total = int((await db.execute(select(func.coalesce(func.sum(Document.size_bytes), 0)))).scalar_one() or 0)

    storage_rows = (
        await db.execute(
            select(
                Tenant.id,
                Tenant.nome,
                Tenant.slug,
                func.coalesce(func.sum(Document.size_bytes), 0).label("storage_used"),
            )
            .join(Document, Document.tenant_id == Tenant.id, isouter=True)
            .group_by(Tenant.id)
            .order_by(func.coalesce(func.sum(Document.size_bytes), 0).desc())
            .limit(5)
        )
    ).all()

    clients_rows = (await db.execute(select(Client.tenant_id, func.count(Client.id)).group_by(Client.tenant_id))).all()
    processes_rows = (await db.execute(select(Process.tenant_id, func.count(Process.id)).group_by(Process.tenant_id))).all()

    clients_map = {tenant_id: int(total) for tenant_id, total in clients_rows}
    processes_map = {tenant_id: int(total) for tenant_id, total in processes_rows}

    volume_candidates: list[PlatformOverviewTopTenant] = []
    for tenant_id, nome, slug, _ in all_tenants:
        volume = clients_map.get(tenant_id, 0) + processes_map.get(tenant_id, 0)
        volume_candidates.append(
            PlatformOverviewTopTenant(tenant_id=tenant_id, tenant_nome=nome, tenant_slug=slug, value=volume)
        )
    volume_candidates.sort(key=lambda item: item.value, reverse=True)

    recent = sorted(all_tenants, key=lambda row: row[3], reverse=True)[:10]

    return PlatformOverviewOut(
        tenants_total=tenants_total,
        users_total=users_total,
        tenants_free=tenants_free,
        tenants_plus=tenants_plus,
        storage_used_bytes_total=storage_used_bytes_total,
        top_storage_tenants=[
            PlatformOverviewTopTenant(tenant_id=tenant_id, tenant_nome=nome, tenant_slug=slug, value=int(storage_used))
            for tenant_id, nome, slug, storage_used in storage_rows
        ],
        top_volume_tenants=volume_candidates[:5],
        recent_tenants=[
            PlatformOverviewRecentTenant(tenant_id=tenant_id, tenant_nome=nome, tenant_slug=slug, created_at=created_at)
            for tenant_id, nome, slug, created_at in recent
        ],
    )


@router.get("/metrics/revenue/overview", response_model=PlatformRevenueOverviewOut)
async def platform_revenue_overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    year: int | None = None,
):
    now = datetime.now(timezone.utc)
    selected_year = year or now.year
    if selected_year < 2000 or selected_year > now.year + 5:
        raise BadRequestError("Ano inválido para consulta de faturamento.")

    reference_month = now.month if selected_year == now.year else 12
    rolling_months = _rolling_months(selected_year, reference_month, total=12)

    price_monthly = await _plus_monthly_price_brl(db)
    rows = (
        await db.execute(
            select(Subscription, Tenant)
            .join(Tenant, Tenant.id == Subscription.tenant_id)
            .where(Tenant.is_active.is_(True))
            .where(Subscription.plan_code == PlanCode.PLUS_MONTHLY_CARD)
        )
    ).all()
    subscriptions = [subscription for subscription, _tenant in rows]

    active_plus_tenants = sum(1 for subscription in subscriptions if _is_active_now(subscription, now))
    mrr = round(active_plus_tenants * price_monthly, 2)
    arr_estimated = round(mrr * 12, 2)

    monthly_series: list[PlatformRevenueMonthlyPoint] = []
    for month_year, month_number in rolling_months:
        month_start, month_end = _month_bounds_utc(month_year, month_number)
        # TODO: substituir essa aproximacao por receita real de invoices/webhooks
        # quando Stripe/MercadoPago estiverem integrados.
        active_count = sum(
            1
            for subscription in subscriptions
            if _is_active_in_month(subscription, month_start, month_end)
        )
        monthly_series.append(
            PlatformRevenueMonthlyPoint(
                month=f"{month_year:04d}-{month_number:02d}",
                value=round(active_count * price_monthly, 2),
            )
        )

    if selected_year > now.year:
        ytd_month_limit = 0
    elif selected_year == now.year:
        ytd_month_limit = now.month
    else:
        ytd_month_limit = 12

    revenue_ytd = 0.0
    for month_number in range(1, ytd_month_limit + 1):
        month_start, month_end = _month_bounds_utc(selected_year, month_number)
        active_count = sum(
            1
            for subscription in subscriptions
            if _is_active_in_month(subscription, month_start, month_end)
        )
        revenue_ytd += active_count * price_monthly

    return PlatformRevenueOverviewOut(
        currency="BRL",
        plan_price_monthly=price_monthly,
        active_plus_tenants=active_plus_tenants,
        mrr=mrr,
        arr_estimated=arr_estimated,
        revenue_ytd=round(revenue_ytd, 2),
        monthly_series=monthly_series,
    )


@router.get("/metrics/revenue/tenants", response_model=list[PlatformRevenueTenantOut])
async def platform_revenue_tenants(
    db: Annotated[AsyncSession, Depends(get_db)],
    status: str = "ACTIVE",
    plan: str = "plus",
):
    normalized_plan = (plan or "plus").strip().lower()
    normalized_status = (status or "ACTIVE").strip().upper()

    if normalized_plan not in {"plus", "plus_monthly", "plus_monthly_card"}:
        return []
    if normalized_status not in {"ACTIVE", "ALL"}:
        return []

    now = datetime.now(timezone.utc)
    price_monthly = await _plus_monthly_price_brl(db)
    rows = (
        await db.execute(
            select(Subscription, Tenant)
            .join(Tenant, Tenant.id == Subscription.tenant_id)
            .where(Tenant.is_active.is_(True))
            .where(Subscription.plan_code == PlanCode.PLUS_MONTHLY_CARD)
        )
    ).all()

    items: list[PlatformRevenueTenantOut] = []
    for subscription, tenant in rows:
        active_now = _is_active_now(subscription, now)
        if normalized_status == "ACTIVE" and not active_now:
            continue

        status_value = str(subscription.status.value if hasattr(subscription.status, "value") else subscription.status).upper()
        items.append(
            PlatformRevenueTenantOut(
                tenant_id=tenant.id,
                tenant_name=tenant.nome,
                tenant_slug=tenant.slug,
                plan="plus",
                status=status_value,
                started_at=subscription.current_period_start or subscription.criado_em,
                next_billing_at=subscription.current_period_end,
                last_payment_at=subscription.last_payment_at,
                price_monthly=price_monthly,
            )
        )

    fallback_sort_date = datetime(1970, 1, 1, tzinfo=timezone.utc)
    items.sort(key=lambda item: item.started_at or item.next_billing_at or fallback_sort_date, reverse=True)
    return items


@router.patch("/tenants/{tenant_id}/limits", response_model=PlatformTenantLimitsOut)
async def update_tenant_limits(
    tenant_id: uuid.UUID,
    payload: PlatformTenantLimitsUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Set per-tenant overrides for product limits.

    Protected by PLATFORM_ADMIN_KEY (router-level dependency).
    """
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise NotFoundError("Tenant não encontrado")

    sub = (await db.execute(select(Subscription).where(Subscription.tenant_id == tenant_id))).scalar_one_or_none()
    if not sub:
        # Keep defaults consistent with BillingService.
        sub = Subscription(tenant_id=tenant_id, plan_code=PlanCode.FREE, status=SubscriptionStatus.free, provider=BillingProvider.FAKE)
        db.add(sub)
        await db.commit()
        await db.refresh(sub)

    old_limits = {
        "max_clients_override": sub.max_clients_override,
        "max_storage_mb_override": sub.max_storage_mb_override,
    }

    data = payload.model_dump(exclude_unset=True)
    if "max_clients_override" in data:
        sub.max_clients_override = data["max_clients_override"]
    if "max_storage_mb_override" in data:
        sub.max_storage_mb_override = data["max_storage_mb_override"]

    db.add(sub)
    await _log_platform_action(
        db,
        action="limits_updated",
        tenant_id=tenant_id,
        payload={
            "old": old_limits,
            "new": {
                "max_clients_override": sub.max_clients_override,
                "max_storage_mb_override": sub.max_storage_mb_override,
            },
        },
    )
    await db.commit()
    await db.refresh(sub)

    return PlatformTenantLimitsOut(
        message="Limites atualizados",
        tenant_id=tenant_id,
        max_clients_override=sub.max_clients_override,
        max_storage_mb_override=sub.max_storage_mb_override,
    )


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
    plan = None
    if sub:
        plan = (await db.execute(select(Plan).where(Plan.code == sub.plan_code))).scalar_one_or_none()

    users_total = int((await db.execute(select(func.count(User.id)).where(User.tenant_id == tenant_id))).scalar_one() or 0)
    clients_total = int((await db.execute(select(func.count(Client.id)).where(Client.tenant_id == tenant_id))).scalar_one() or 0)
    processes_total = int((await db.execute(select(func.count(Process.id)).where(Process.tenant_id == tenant_id))).scalar_one() or 0)
    storage_used = int(
        (await db.execute(select(func.coalesce(func.sum(Document.size_bytes), 0)).where(Document.tenant_id == tenant_id))).scalar_one()
        or 0
    )
    storage_limit = _storage_limit_bytes(sub, plan)

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
        users_total=users_total,
        clients_total=clients_total,
        processes_total=processes_total,
        storage_used_bytes=storage_used,
        storage_limit_bytes=storage_limit,
    )


@router.patch("/tenants/{tenant_id}/subscription", response_model=PlatformTenantSubscriptionOut)
async def update_tenant_subscription(
    tenant_id: uuid.UUID,
    payload: PlatformTenantSubscriptionUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise NotFoundError("Tenant não encontrado")

    sub = (await db.execute(select(Subscription).where(Subscription.tenant_id == tenant_id))).scalar_one_or_none()
    if not sub:
        sub = Subscription(tenant_id=tenant_id, plan_code=PlanCode.FREE, status=SubscriptionStatus.free, provider=BillingProvider.FAKE)

    old_data = {
        "plan_code": str(sub.plan_code.value if hasattr(sub.plan_code, "value") else sub.plan_code),
        "status": str(sub.status.value if hasattr(sub.status, "value") else sub.status),
    }

    changed = False
    if payload.plan_code is not None:
        sub.plan_code = payload.plan_code
        changed = True
    if payload.status is not None:
        sub.status = payload.status
        changed = True

    if not changed:
        raise BadRequestError("Informe pelo menos um campo para atualizar.")

    db.add(sub)
    await _log_platform_action(
        db,
        action="subscription_updated",
        tenant_id=tenant_id,
        payload={
            "old": old_data,
            "new": {
                "plan_code": str(sub.plan_code.value if hasattr(sub.plan_code, "value") else sub.plan_code),
                "status": str(sub.status.value if hasattr(sub.status, "value") else sub.status),
            },
        },
    )
    await db.commit()
    await db.refresh(sub)

    return PlatformTenantSubscriptionOut(
        message="Assinatura atualizada",
        tenant_id=tenant_id,
        plan_code=sub.plan_code,
        status=sub.status,
    )


@router.post("/tenants/{tenant_id}/recalculate-storage", response_model=PlatformTenantStorageOut)
async def recalculate_tenant_storage(
    tenant_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise NotFoundError("Tenant não encontrado")

    storage_used = int(
        (await db.execute(select(func.coalesce(func.sum(Document.size_bytes), 0)).where(Document.tenant_id == tenant_id))).scalar_one()
        or 0
    )

    await _log_platform_action(
        db,
        action="storage_recalculated",
        tenant_id=tenant_id,
        payload={"storage_used_bytes": storage_used},
    )
    await db.commit()

    return PlatformTenantStorageOut(
        message="Consumo recalculado com sucesso",
        tenant_id=tenant_id,
        storage_used_bytes=storage_used,
    )


@router.get("/audit", response_model=list[PlatformAuditLogOut])
async def list_platform_audit_logs(
    db: Annotated[AsyncSession, Depends(get_db)],
    tenant_id: uuid.UUID | None = None,
    limit: int = 50,
):
    safe_limit = max(1, min(limit, 200))
    stmt = select(PlatformAuditLog).order_by(PlatformAuditLog.created_at.desc()).limit(safe_limit)
    if tenant_id is not None:
        stmt = stmt.where(PlatformAuditLog.tenant_id == tenant_id)
    return list((await db.execute(stmt)).scalars().all())


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
        await _log_platform_action(db, action="tenant_deactivated", tenant_id=tenant.id, payload={"is_active": False})
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
        await _log_platform_action(db, action="tenant_activated", tenant_id=tenant.id, payload={"is_active": True})
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
