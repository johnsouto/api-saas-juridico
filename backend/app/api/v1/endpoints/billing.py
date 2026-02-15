from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.config import settings
from app.core.exceptions import BadRequestError
from app.db.session import get_db
from app.models.billing_event import BillingEvent
from app.models.enums import PlanCode, SubscriptionStatus, UserRole
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.billing import BillingCancelIn, BillingCancelOut, BillingCheckoutOut, BillingStatusOut
from app.services.action_audit_service import log_security_action
from app.services.billing_service import BillingService
from app.services.email_service import EmailService
from app.services.export_service import ExportRateLimitError, TenantExportService
from app.services.payment_service import ProviderEvent, get_payment_provider


router = APIRouter()
logger = logging.getLogger(__name__)


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
    try:
        return await billing.start_checkout(
            db,
            tenant_id=user.tenant_id,
            plan_code=plan_code,
            payer_email=user.email,
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except ValueError as exc:
        logger.warning(
            "billing checkout rejected tenant=%s plan=%s provider=%s reason=%s",
            user.tenant_id,
            plan_code.value,
            billing.provider.provider.value,
            str(exc),
        )
        raise BadRequestError(str(exc)) from exc


@router.post("/cancel", response_model=BillingCancelOut)
async def cancel_subscription(
    request: Request,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.admin))],
    payload: BillingCancelIn | None = None,
):
    now = datetime.now(timezone.utc)
    wants_export = bool(payload and payload.generate_export_now)
    sub = (await db.execute(select(Subscription).where(Subscription.tenant_id == user.tenant_id))).scalar_one_or_none()

    # FREE / no active subscription => no-op (explicit 200 response).
    if not sub or sub.plan_code == PlanCode.FREE or sub.status in (SubscriptionStatus.free, SubscriptionStatus.canceled, SubscriptionStatus.expired):
        await log_security_action(
            db,
            action="BILLING_CANCEL_REQUESTED",
            user=user,
            tenant_id=user.tenant_id,
            request=request,
            metadata={"plan_code": "FREE", "no_subscription": True},
        )
        await db.commit()
        return BillingCancelOut(
            ok=True,
            message="Você está no Plano Free e não possui assinatura ativa.",
            cancel_at_period_end=False,
            access_until=None,
            refund_status="NONE",
        )

    access_until = sub.current_period_end or sub.grace_period_end
    if not access_until:
        # Fallback defensivo para não bloquear o fluxo em casos legados.
        access_until = now + timedelta(days=30)

    sub.cancel_at_period_end = True
    sub.cancellation_requested_at = now
    if sub.current_period_start and (now - sub.current_period_start) <= timedelta(days=7):
        sub.refund_status = "PENDING_REVIEW"
    else:
        sub.refund_status = "NONE"

    export_requested = False
    export_id = None
    export_rate_limited = False
    export_retry_after_seconds = None
    latest_export_id = None

    if wants_export:
        export_service = TenantExportService()
        try:
            exp = await export_service.request_export(
                db,
                tenant_id=user.tenant_id,
                requested_by_user_id=user.id,
                note="manual_on_billing_cancel",
                enforce_rate_limit=True,
            )
            background.add_task(export_service.generate_export_background, exp.id)
            export_requested = True
            export_id = exp.id
        except ExportRateLimitError as exc:
            export_rate_limited = True
            export_retry_after_seconds = exc.retry_after_seconds
            latest_export_id = exc.latest_export.id if exc.latest_export else None

    db.add(
        BillingEvent(
            tenant_id=user.tenant_id,
            provider=sub.provider.value,
            event_type="subscription_cancel_requested",
            external_id=sub.provider_subscription_id,
            payload_json={
                "plan_code": sub.plan_code.value,
                "status": sub.status.value,
                "cancel_at_period_end": True,
                "access_until": access_until.isoformat() if access_until else None,
                "refund_status": sub.refund_status,
                "export_requested": export_requested,
                "export_id": str(export_id) if export_id else None,
                "export_rate_limited": export_rate_limited,
                "latest_export_id": str(latest_export_id) if latest_export_id else None,
            },
        )
    )
    await log_security_action(
        db,
        action="BILLING_CANCEL_REQUESTED",
        user=user,
        tenant_id=user.tenant_id,
        request=request,
        metadata={
            "plan_code": sub.plan_code.value,
            "access_until": access_until,
            "refund_status": sub.refund_status,
            "export_requested": export_requested,
            "export_id": export_id,
            "export_rate_limited": export_rate_limited,
            "latest_export_id": latest_export_id,
        },
    )
    db.add(sub)
    await db.commit()

    access_until_label = access_until.astimezone(timezone.utc).strftime("%d/%m/%Y")
    subject = "Assinatura cancelada ao fim do período — Elemento Juris"
    body_lines = [
        "Recebemos sua solicitação de cancelamento.",
        "",
        "Sua assinatura foi configurada para encerrar ao final do período já pago.",
        f"Você manterá acesso ao Plano Plus até: {access_until_label}.",
        f"Status de estorno: {sub.refund_status}.",
    ]
    if export_requested and export_id:
        body_lines.extend(["", f"Exportação solicitada: {settings.PUBLIC_APP_URL.rstrip('/')}/exports/{export_id}"])
    if export_rate_limited:
        body_lines.extend(
            [
                "",
                "Não foi possível gerar novo export agora (limite de 24h).",
                f"Tente novamente em aproximadamente {export_retry_after_seconds or 0} segundos.",
                (
                    f"Último export: {settings.PUBLIC_APP_URL.rstrip('/')}/exports/{latest_export_id}"
                    if latest_export_id
                    else "Nenhum export recente encontrado para consulta."
                ),
            ]
        )
    body_lines.extend(["", "Não é necessário responder este e-mail.", "", "Equipe Elemento Juris"])
    EmailService().send_generic_email(background, to_emails=[user.email], subject=subject, body="\n".join(body_lines))

    return BillingCancelOut(
        ok=True,
        message="Assinatura cancelada ao final do período já pago.",
        cancel_at_period_end=True,
        access_until=access_until,
        refund_status=sub.refund_status,
        export_requested=export_requested,
        export_id=export_id,
        export_rate_limited=export_rate_limited,
        export_retry_after_seconds=export_retry_after_seconds,
        latest_export_id=latest_export_id,
    )


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
