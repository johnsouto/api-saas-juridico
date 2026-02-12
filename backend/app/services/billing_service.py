from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import BackgroundTasks
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.billing_event import BillingEvent
from app.models.enums import BillingProvider, PlanCode, SubscriptionStatus, UserRole
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.billing import BillingCheckoutOut, BillingLimits, BillingStatusOut
from app.services.email_service import EmailService
from app.services.payment_service import PaymentProvider, ProviderEvent


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _is_plus_effective(sub: Subscription, *, now: datetime) -> bool:
    if sub.status == SubscriptionStatus.active:
        return bool(sub.current_period_end and now <= sub.current_period_end)
    if sub.status == SubscriptionStatus.past_due:
        return bool(sub.grace_period_end and now <= sub.grace_period_end)
    return False


def _effective_plan_code(sub: Subscription, *, now: datetime) -> PlanCode:
    return sub.plan_code if _is_plus_effective(sub, now=now) else PlanCode.FREE


@dataclass(frozen=True)
class BillingService:
    provider: PaymentProvider
    email_service: EmailService

    async def _get_or_create_subscription(self, db: AsyncSession, *, tenant_id: uuid.UUID) -> Subscription:
        stmt = select(Subscription).where(Subscription.tenant_id == tenant_id)
        sub = (await db.execute(stmt)).scalar_one_or_none()
        if sub:
            return sub

        sub = Subscription(
            tenant_id=tenant_id,
            plan_code=PlanCode.FREE,
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
        await db.commit()
        await db.refresh(sub)
        return sub

    async def _get_plan(self, db: AsyncSession, *, code: PlanCode) -> Plan:
        stmt = select(Plan).where(Plan.code == code)
        plan = (await db.execute(stmt)).scalar_one()
        return plan

    async def get_status(self, db: AsyncSession, *, tenant_id: uuid.UUID, now: datetime | None = None) -> BillingStatusOut:
        now = now or _utcnow()
        sub = await self._get_or_create_subscription(db, tenant_id=tenant_id)

        effective_code = _effective_plan_code(sub, now=now)
        plan = await self._get_plan(db, code=effective_code)

        message = self._build_status_message(sub, effective_plan_code=effective_code, now=now)

        # Apply per-tenant overrides (set by platform admin) so the UI and enforcement stay consistent.
        max_clients = sub.max_clients_override if sub.max_clients_override is not None else plan.max_clients
        max_storage_mb = sub.max_storage_mb_override if sub.max_storage_mb_override is not None else plan.max_storage_mb

        return BillingStatusOut(
            tenant_id=tenant_id,
            plan_code=effective_code,
            status=sub.status,
            current_period_end=sub.current_period_end,
            grace_period_end=sub.grace_period_end,
            is_plus_effective=_is_plus_effective(sub, now=now),
            limits=BillingLimits(max_users=plan.max_users, max_clients=max_clients, max_storage_mb=max_storage_mb),
            message=message,
        )

    def _build_status_message(self, sub: Subscription, *, effective_plan_code: PlanCode, now: datetime) -> str | None:
        if sub.status == SubscriptionStatus.past_due and sub.grace_period_end:
            end = sub.grace_period_end.astimezone(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
            return f"Pagamento pendente. Você mantém acesso ao Plus até {end}."

        if sub.plan_code == PlanCode.PLUS_ANNUAL_PIX and sub.status == SubscriptionStatus.active and sub.current_period_end:
            days = (sub.current_period_end.date() - now.date()).days
            if days in (30, 7, 1):
                return f"Seu Plus anual expira em {days} dia(s). Renove para manter acesso."
            if days < 0 and effective_plan_code == PlanCode.FREE:
                return "Seu Plus anual expirou. Você voltou para o Free."

        if effective_plan_code == PlanCode.FREE and sub.status in (SubscriptionStatus.canceled, SubscriptionStatus.expired):
            return "Seu plano Plus não está ativo. Você está no Free."

        return None

    async def start_checkout(
        self,
        db: AsyncSession,
        *,
        tenant_id: uuid.UUID,
        plan_code: PlanCode,
        success_url: str,
        cancel_url: str,
    ) -> BillingCheckoutOut:
        if plan_code == PlanCode.FREE:
            raise ValueError("Plano inválido")

        sub = await self._get_or_create_subscription(db, tenant_id=tenant_id)

        result = self.provider.create_checkout(
            tenant_id=str(tenant_id),
            plan_code=plan_code,
            success_url=success_url,
            cancel_url=cancel_url,
        )

        # Persist external IDs for correlation/debug.
        sub.provider = self.provider.provider
        if result.provider_subscription_id:
            sub.provider_subscription_id = result.provider_subscription_id
        if result.provider_payment_id:
            sub.provider_payment_id = result.provider_payment_id
        sub.last_payment_status = "checkout_created"
        db.add(sub)

        await self._add_event(
            db,
            tenant_id=tenant_id,
            provider=self.provider.provider.value,
            event_type="checkout_created",
            external_id=result.provider_subscription_id or result.provider_payment_id,
            payload={
                "plan_code": plan_code.value,
                "success_url": success_url,
                "cancel_url": cancel_url,
            },
        )

        await db.commit()

        return BillingCheckoutOut(
            checkout_url=result.checkout_url,
            pix_qr_code=result.pix_qr_code,
            pix_copy_paste=result.pix_copy_paste,
            expires_at=result.expires_at,
        )

    async def process_provider_event(
        self,
        db: AsyncSession,
        background: BackgroundTasks | None,
        *,
        event: ProviderEvent,
        now: datetime | None = None,
    ) -> None:
        now = now or _utcnow()

        tenant_id = uuid.UUID(event.tenant_id)
        sub = await self._get_or_create_subscription(db, tenant_id=tenant_id)

        await self._add_event(
            db,
            tenant_id=tenant_id,
            provider=event.provider.value,
            event_type=event.event_type,
            external_id=event.external_id,
            payload=event.payload,
        )

        if event.event_type == "payment_succeeded":
            if not event.plan_code:
                raise ValueError("plan_code ausente")

            sub.provider = event.provider
            sub.plan_code = event.plan_code
            sub.status = SubscriptionStatus.active
            sub.cancel_at_period_end = False
            sub.grace_period_end = None
            sub.current_period_start = now
            if event.plan_code == PlanCode.PLUS_MONTHLY_CARD:
                sub.current_period_end = now + timedelta(days=30)
            elif event.plan_code == PlanCode.PLUS_ANNUAL_PIX:
                sub.current_period_end = now + timedelta(days=365)
            else:
                raise ValueError("plan_code inválido")

            sub.last_payment_at = now
            sub.last_payment_status = event.payment_status or "succeeded"

        elif event.event_type == "payment_failed":
            # Monthly card renewal failed: keep access during grace period.
            sub.provider = event.provider
            sub.plan_code = PlanCode.PLUS_MONTHLY_CARD
            sub.status = SubscriptionStatus.past_due
            sub.grace_period_end = now + timedelta(days=7)
            sub.last_payment_at = now
            sub.last_payment_status = event.payment_status or "failed"

            if background:
                await self._send_past_due_email(db, background, tenant_id=tenant_id, sub=sub, now=now)

        elif event.event_type == "subscription_canceled":
            # Provider acknowledged cancellation. We keep access until period end.
            sub.cancel_at_period_end = True
            sub.last_payment_status = event.payment_status or "canceled"

        db.add(sub)
        await db.commit()

    async def run_scheduled_maintenance(
        self,
        db: AsyncSession,
        background: BackgroundTasks | None,
        *,
        now: datetime | None = None,
    ) -> dict[str, int]:
        now = now or _utcnow()

        expired = 0
        canceled = 0
        emails = 0

        # 1) Annual PIX: reminders + expiration
        annual_stmt: Select[Any] = select(Subscription).where(
            Subscription.plan_code == PlanCode.PLUS_ANNUAL_PIX,
            Subscription.status == SubscriptionStatus.active,
            Subscription.current_period_end.is_not(None),
        )
        for sub in (await db.execute(annual_stmt)).scalars().all():
            if not sub.current_period_end:
                continue
            days_left = (sub.current_period_end.date() - now.date()).days
            if days_left in (30, 7, 1) and background:
                sent = await self._send_annual_expiring_email(db, background, sub=sub, days_left=days_left)
                emails += int(sent)

            if now > sub.current_period_end:
                period_end = sub.current_period_end
                # Expired: downgrade.
                sub.status = SubscriptionStatus.expired
                sub.plan_code = PlanCode.FREE
                sub.cancel_at_period_end = False
                sub.grace_period_end = None
                db.add(sub)
                expired += 1

                await self._add_event(
                    db,
                    tenant_id=sub.tenant_id,
                    provider=sub.provider.value,
                    event_type="subscription_expired",
                    external_id=None,
                    payload={"current_period_end": period_end.isoformat()},
                )

                if background:
                    sent = await self._send_annual_expired_email(db, background, tenant_id=sub.tenant_id, period_end=period_end)
                    emails += int(sent)

        # 2) Card: grace reminders + cancellation
        past_due_stmt: Select[Any] = select(Subscription).where(
            Subscription.status == SubscriptionStatus.past_due,
            Subscription.grace_period_end.is_not(None),
        )
        for sub in (await db.execute(past_due_stmt)).scalars().all():
            if not sub.grace_period_end:
                continue
            grace_end = sub.grace_period_end
            days_left = (sub.grace_period_end.date() - now.date()).days
            if days_left in (2, 1) and background:
                sent = await self._send_past_due_reminder_email(db, background, sub=sub, days_left=days_left)
                emails += int(sent)

            if now > grace_end:
                sub.status = SubscriptionStatus.canceled
                sub.plan_code = PlanCode.FREE
                sub.grace_period_end = None
                sub.cancel_at_period_end = False
                db.add(sub)
                canceled += 1

                await self._add_event(
                    db,
                    tenant_id=sub.tenant_id,
                    provider=sub.provider.value,
                    event_type="subscription_canceled_grace_end",
                    external_id=None,
                    payload={"grace_period_end": grace_end.isoformat()},
                )

                if background:
                    sent = await self._send_canceled_email(db, background, tenant_id=sub.tenant_id)
                    emails += int(sent)

        # 3) User-initiated cancel at period end
        cancel_stmt: Select[Any] = select(Subscription).where(
            Subscription.cancel_at_period_end.is_(True),
            Subscription.current_period_end.is_not(None),
            Subscription.status == SubscriptionStatus.active,
        )
        for sub in (await db.execute(cancel_stmt)).scalars().all():
            if sub.current_period_end and now > sub.current_period_end:
                sub.status = SubscriptionStatus.canceled
                sub.plan_code = PlanCode.FREE
                sub.cancel_at_period_end = False
                db.add(sub)
                canceled += 1

                await self._add_event(
                    db,
                    tenant_id=sub.tenant_id,
                    provider=sub.provider.value,
                    event_type="subscription_canceled_period_end",
                    external_id=None,
                    payload={"current_period_end": sub.current_period_end.isoformat()},
                )

        await db.commit()
        return {"expired": expired, "canceled": canceled, "emails_sent": emails}

    async def _add_event(
        self,
        db: AsyncSession,
        *,
        tenant_id: uuid.UUID,
        provider: str,
        event_type: str,
        external_id: str | None,
        payload: dict[str, Any],
    ) -> None:
        ev = BillingEvent(
            tenant_id=tenant_id,
            provider=provider,
            event_type=event_type,
            external_id=external_id,
            payload_json=payload,
        )
        db.add(ev)

    async def _tenant_admin_emails(self, db: AsyncSession, *, tenant_id: uuid.UUID) -> list[str]:
        stmt = (
            select(User.email)
            .where(User.tenant_id == tenant_id)
            .where(User.role == UserRole.admin)
            .where(User.is_active.is_(True))
            .order_by(User.criado_em.asc())
        )
        emails = [str(e) for (e,) in (await db.execute(stmt)).all()]
        return list(dict.fromkeys(emails))  # unique, stable

    async def _has_email_event(self, db: AsyncSession, *, tenant_id: uuid.UUID, key: str) -> bool:
        stmt = (
            select(BillingEvent.id)
            .where(BillingEvent.tenant_id == tenant_id)
            .where(BillingEvent.event_type == "email_sent")
            .where(BillingEvent.external_id == key)
            .limit(1)
        )
        return (await db.execute(stmt)).scalar_one_or_none() is not None

    async def _record_email_event(self, db: AsyncSession, *, tenant_id: uuid.UUID, key: str, payload: dict[str, Any]) -> None:
        await self._add_event(
            db,
            tenant_id=tenant_id,
            provider="internal",
            event_type="email_sent",
            external_id=key,
            payload=payload,
        )

    async def _send_past_due_email(self, db: AsyncSession, background: BackgroundTasks, *, tenant_id: uuid.UUID, sub: Subscription, now: datetime) -> None:
        if not sub.grace_period_end:
            return
        key = f"email:past_due:created:{sub.id}:{sub.grace_period_end.date().isoformat()}"
        if await self._has_email_event(db, tenant_id=tenant_id, key=key):
            return
        emails = await self._tenant_admin_emails(db, tenant_id=tenant_id)
        if not emails:
            return
        end = sub.grace_period_end.astimezone(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
        subject = "Pagamento pendente — Elemento Juris"
        body = (
            "Detectamos uma falha no pagamento do Plano Plus (cartão).\n\n"
            f"Você mantém acesso ao Plus até: {end}\n\n"
            "Acesse o billing para regularizar:\n"
            f"{settings.PUBLIC_APP_URL.rstrip('/')}/billing?plan=plus_monthly_card&next=/dashboard\n"
        )
        self.email_service.send_generic_email(background, to_emails=emails, subject=subject, body=body)
        await self._record_email_event(db, tenant_id=tenant_id, key=key, payload={"type": "past_due_created", "at": now.isoformat()})

    async def _send_past_due_reminder_email(self, db: AsyncSession, background: BackgroundTasks, *, sub: Subscription, days_left: int) -> bool:
        if not sub.grace_period_end:
            return False
        key = f"email:past_due:reminder:{days_left}:{sub.id}:{sub.grace_period_end.date().isoformat()}"
        if await self._has_email_event(db, tenant_id=sub.tenant_id, key=key):
            return False
        emails = await self._tenant_admin_emails(db, tenant_id=sub.tenant_id)
        if not emails:
            return False
        end = sub.grace_period_end.astimezone(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
        subject = "Lembrete: pagamento pendente — Elemento Juris"
        body = (
            f"Seu pagamento do Plano Plus (cartão) está pendente.\n\n"
            f"Prazo final para regularizar: {end}\n"
            f"Faltam {days_left} dia(s).\n\n"
            f"Acesse:\n{settings.PUBLIC_APP_URL.rstrip('/')}/billing?plan=plus_monthly_card&next=/dashboard\n"
        )
        self.email_service.send_generic_email(background, to_emails=emails, subject=subject, body=body)
        await self._record_email_event(db, tenant_id=sub.tenant_id, key=key, payload={"type": "past_due_reminder", "days_left": days_left})
        return True

    async def _send_canceled_email(self, db: AsyncSession, background: BackgroundTasks, *, tenant_id: uuid.UUID) -> bool:
        key = f"email:subscription:canceled:{tenant_id}"
        # Allow re-send on a different day if needed, but keep it simple for now.
        if await self._has_email_event(db, tenant_id=tenant_id, key=key):
            return False
        emails = await self._tenant_admin_emails(db, tenant_id=tenant_id)
        if not emails:
            return False
        subject = "Plano Plus cancelado — Elemento Juris"
        body = (
            "Sua assinatura do Plano Plus foi cancelada.\n\n"
            "Você voltou para o Plano Free.\n\n"
            f"Reative quando quiser:\n{settings.PUBLIC_APP_URL.rstrip('/')}/billing?plan=plus&next=/dashboard\n"
        )
        self.email_service.send_generic_email(background, to_emails=emails, subject=subject, body=body)
        await self._record_email_event(db, tenant_id=tenant_id, key=key, payload={"type": "subscription_canceled"})
        return True

    async def _send_annual_expiring_email(self, db: AsyncSession, background: BackgroundTasks, *, sub: Subscription, days_left: int) -> bool:
        if not sub.current_period_end:
            return False
        key = f"email:annual:expiring:{days_left}:{sub.id}:{sub.current_period_end.date().isoformat()}"
        if await self._has_email_event(db, tenant_id=sub.tenant_id, key=key):
            return False
        emails = await self._tenant_admin_emails(db, tenant_id=sub.tenant_id)
        if not emails:
            return False
        end = sub.current_period_end.astimezone(timezone.utc).strftime("%d/%m/%Y")
        subject = "Seu Plus anual está expirando — Elemento Juris"
        body = (
            "Plano Plus anual (Pix): aviso de expiração.\n\n"
            f"Data de expiração: {end}\n"
            f"Faltam {days_left} dia(s).\n\n"
            "Renove para manter acesso:\n"
            f"{settings.PUBLIC_APP_URL.rstrip('/')}/billing?plan=plus_annual_pix&next=/dashboard\n"
        )
        self.email_service.send_generic_email(background, to_emails=emails, subject=subject, body=body)
        await self._record_email_event(db, tenant_id=sub.tenant_id, key=key, payload={"type": "annual_expiring", "days_left": days_left})
        return True

    async def _send_annual_expired_email(self, db: AsyncSession, background: BackgroundTasks, *, tenant_id: uuid.UUID, period_end: datetime) -> bool:
        key = f"email:annual:expired:{tenant_id}:{period_end.date().isoformat()}"
        if await self._has_email_event(db, tenant_id=tenant_id, key=key):
            return False
        emails = await self._tenant_admin_emails(db, tenant_id=tenant_id)
        if not emails:
            return False
        end = period_end.astimezone(timezone.utc).strftime("%d/%m/%Y")
        subject = "Seu Plus anual expirou — Elemento Juris"
        body = (
            "Plano Plus anual (Pix): expiração confirmada.\n\n"
            f"Data de expiração: {end}\n\n"
            "Seu acesso voltou para o Plano Free. Renove quando quiser:\n"
            f"{settings.PUBLIC_APP_URL.rstrip('/')}/billing?plan=plus_annual_pix&next=/dashboard\n"
        )
        self.email_service.send_generic_email(background, to_emails=emails, subject=subject, body=body)
        await self._record_email_event(db, tenant_id=tenant_id, key=key, payload={"type": "annual_expired"})
        return True
