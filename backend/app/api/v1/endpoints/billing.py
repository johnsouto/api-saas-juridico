from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.exceptions import BadRequestError
from app.db.session import get_db
from app.models.billing_event import BillingEvent
from app.models.enums import PlanCode, UserRole
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.billing import BillingCancelOut, BillingCheckoutOut, BillingStatusOut
from app.services.billing_service import BillingService
from app.services.email_service import EmailService
from app.services.payment_service import ProviderEvent, get_payment_provider


router = APIRouter()


def _app_base_url(request: Request) -> str:
    # Same pattern used in platform endpoints (works behind Traefik).
    origin = request.headers.get("origin")
    if origin:
        return origin.rstrip("/")
    host = request.headers.get("host")
    scheme = request.headers.get("x-forwarded-proto") or request.url.scheme
    if host:
        return f"{scheme}://{host}".rstrip("/")
    return str(request.base_url).rstrip("/")


def _safe_next(next_path: str | None) -> str:
    if not next_path:
        return "/dashboard"
    v = next_path.strip()
    if not v.startswith("/") or v.startswith("//"):
        return "/dashboard"
    return v


def _parse_plan_param(plan: str) -> PlanCode:
    p = (plan or "").strip().lower()
    if p in ("plus", "plus_monthly_card", "monthly", "card"):
        return PlanCode.PLUS_MONTHLY_CARD
    if p in ("plus_annual_pix", "annual", "pix", "yearly"):
        return PlanCode.PLUS_ANNUAL_PIX
    raise BadRequestError("Plano inválido")


@router.get("/status", response_model=BillingStatusOut)
async def billing_status(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    billing = BillingService(provider=get_payment_provider(), email_service=EmailService())
    return await billing.get_status(db, tenant_id=user.tenant_id)


@router.post("/checkout", response_model=BillingCheckoutOut)
async def start_checkout(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.admin))],
    plan: str = "plus",
    next: str | None = None,  # noqa: A002
):
    plan_code = _parse_plan_param(plan)
    next_path = _safe_next(next)

    base = _app_base_url(request)
    success_url = f"{base}{next_path}"
    cancel_url = f"{base}/billing?plan=plus&next={next_path}"

    billing = BillingService(provider=get_payment_provider(), email_service=EmailService())
    return await billing.start_checkout(
        db,
        tenant_id=user.tenant_id,
        plan_code=plan_code,
        success_url=success_url,
        cancel_url=cancel_url,
    )


@router.post("/cancel", response_model=BillingCancelOut)
async def cancel_subscription(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    billing = BillingService(provider=get_payment_provider(), email_service=EmailService())

    # Cancel is supported only for the monthly card subscription.
    sub = (await db.execute(select(Subscription).where(Subscription.tenant_id == user.tenant_id))).scalar_one()
    if sub.plan_code != PlanCode.PLUS_MONTHLY_CARD:
        raise BadRequestError("Cancelamento disponível apenas para o Plus Mensal (cartão)")

    # Best-effort: ask provider to cancel at period end (portal flow in real providers).
    if sub.provider_subscription_id:
        try:
            billing.provider.cancel_subscription(provider_subscription_id=sub.provider_subscription_id)
        except NotImplementedError:
            # Keep UX working even if provider stub is selected.
            raise BadRequestError("Provider de billing não implementado") from None

    sub.cancel_at_period_end = True
    db.add(
        BillingEvent(
            tenant_id=user.tenant_id,
            provider=sub.provider.value,
            event_type="subscription_cancel_requested",
            external_id=sub.provider_subscription_id,
            payload_json={"plan_code": sub.plan_code.value, "status": sub.status.value},
        )
    )
    db.add(sub)
    await db.commit()
    return BillingCancelOut(message="Assinatura marcada para cancelamento ao fim do período")


@router.post("/fake/confirm", response_model=dict)
async def fake_confirm(
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.admin))],
    plan: str = "plus",
    result: str = "succeeded",
    external_id: str | None = None,
):
    """
    Internal helper used by the Fake provider UI.

    This simulates a gateway webhook without exposing any webhook secret to the browser.
    """
    provider = get_payment_provider()
    if provider.provider.value != "FAKE":
        raise BadRequestError("Fake confirm disponível apenas com BILLING_PROVIDER=FAKE")

    plan_code = _parse_plan_param(plan)
    event_type = "payment_succeeded" if result.lower() in ("succeeded", "success", "ok") else "payment_failed"

    billing = BillingService(provider=provider, email_service=EmailService())
    event = ProviderEvent(
        provider=provider.provider,
        event_type=event_type,
        tenant_id=str(user.tenant_id),
        plan_code=plan_code,
        external_id=external_id,
        payment_status=result,
        payload={"source": "fake_confirm", "result": result, "plan_code": plan_code.value, "external_id": external_id},
    )
    await billing.process_provider_event(
        db,
        background=background,
        event=event,
    )
    return {"ok": True}
