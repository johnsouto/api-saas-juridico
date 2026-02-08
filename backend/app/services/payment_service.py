from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol

from app.core.config import settings
from app.models.enums import BillingProvider, PlanCode


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class CheckoutResult:
    # Card flow
    checkout_url: str | None = None
    provider_subscription_id: str | None = None

    # PIX flow
    pix_qr_code: str | None = None
    pix_copy_paste: str | None = None
    expires_at: datetime | None = None
    provider_payment_id: str | None = None


@dataclass(frozen=True)
class ProviderEvent:
    provider: BillingProvider
    event_type: str
    tenant_id: str
    plan_code: PlanCode | None
    external_id: str | None
    payment_status: str | None
    payload: dict[str, Any]


class PaymentProvider(Protocol):
    provider: BillingProvider

    def create_checkout(
        self,
        *,
        tenant_id: str,
        plan_code: PlanCode,
        success_url: str,
        cancel_url: str,
    ) -> CheckoutResult:
        raise NotImplementedError

    def handle_webhook(self, *, headers: dict[str, str], body: bytes) -> ProviderEvent:
        raise NotImplementedError

    def cancel_subscription(self, *, provider_subscription_id: str) -> None:
        raise NotImplementedError


def get_payment_provider() -> PaymentProvider:
    """
    Factory for the configured billing provider.

    NOTE: For now we only implement the fake provider. Stripe/Mercado Pago are
    intentionally left as stubs so the architecture is ready for real
    integrations later.
    """
    raw = (settings.BILLING_PROVIDER or "FAKE").strip().upper()
    if raw == BillingProvider.FAKE.value:
        return FakePaymentProvider()
    if raw == BillingProvider.STRIPE.value:
        return StripePaymentProvider()
    if raw == BillingProvider.MERCADOPAGO.value:
        return MercadoPagoPaymentProvider()
    raise ValueError("Unsupported BILLING_PROVIDER")


def _require_webhook_secret(headers: dict[str, str]) -> None:
    """
    Minimal shared-secret verification for webhook endpoints.

    TODO: replace with provider-native signature verification (Stripe, Mercado Pago).
    """
    secret = settings.BILLING_WEBHOOK_SECRET
    if not secret:
        return
    provided = headers.get("x-webhook-secret") or headers.get("X-Webhook-Secret")
    if not provided or provided != secret:
        raise ValueError("Invalid webhook secret")


@dataclass(frozen=True)
class FakePaymentProvider:
    """
    Simulates Stripe/Mercado Pago behavior for local/prototyping.

    IMPORTANT: This provider does not take real payments.
    """

    provider: BillingProvider = BillingProvider.FAKE

    def create_checkout(
        self,
        *,
        tenant_id: str,
        plan_code: PlanCode,
        success_url: str,
        cancel_url: str,
    ) -> CheckoutResult:
        if plan_code == PlanCode.PLUS_MONTHLY_CARD:
            provider_subscription_id = f"fake_sub_{uuid.uuid4()}"
            checkout_url = f"/billing/fake/confirm?flow=card&sub={provider_subscription_id}&next={success_url}"
            return CheckoutResult(checkout_url=checkout_url, provider_subscription_id=provider_subscription_id)

        if plan_code == PlanCode.PLUS_ANNUAL_PIX:
            provider_payment_id = f"fake_pix_{uuid.uuid4()}"
            expires_at = _utcnow() + timedelta(minutes=30)
            copy_paste = f"FAKE-PIX:{provider_payment_id}:{tenant_id}"
            qr = f"[FAKE QR] {copy_paste}"
            return CheckoutResult(
                pix_qr_code=qr,
                pix_copy_paste=copy_paste,
                expires_at=expires_at,
                provider_payment_id=provider_payment_id,
            )

        raise ValueError("Unsupported plan_code")

    def handle_webhook(self, *, headers: dict[str, str], body: bytes) -> ProviderEvent:
        _require_webhook_secret(headers)
        data = json.loads(body.decode("utf-8") or "{}")
        plan_raw = data.get("plan_code")
        plan_code = PlanCode(plan_raw) if plan_raw else None
        return ProviderEvent(
            provider=self.provider,
            event_type=str(data.get("event_type") or ""),
            tenant_id=str(data.get("tenant_id") or ""),
            plan_code=plan_code,
            external_id=str(data.get("external_id")) if data.get("external_id") else None,
            payment_status=str(data.get("payment_status")) if data.get("payment_status") else None,
            payload={str(k): v for k, v in dict(data).items()},
        )

    def cancel_subscription(self, *, provider_subscription_id: str) -> None:
        # No-op (fake).
        return


@dataclass(frozen=True)
class StripePaymentProvider:
    provider: BillingProvider = BillingProvider.STRIPE

    def create_checkout(
        self,
        *,
        tenant_id: str,
        plan_code: PlanCode,
        success_url: str,
        cancel_url: str,
    ) -> CheckoutResult:
        raise NotImplementedError("Stripe provider not implemented yet")

    def handle_webhook(self, *, headers: dict[str, str], body: bytes) -> ProviderEvent:
        raise NotImplementedError("Stripe webhook not implemented yet")

    def cancel_subscription(self, *, provider_subscription_id: str) -> None:
        raise NotImplementedError("Stripe cancel not implemented yet")


@dataclass(frozen=True)
class MercadoPagoPaymentProvider:
    provider: BillingProvider = BillingProvider.MERCADOPAGO

    def create_checkout(
        self,
        *,
        tenant_id: str,
        plan_code: PlanCode,
        success_url: str,
        cancel_url: str,
    ) -> CheckoutResult:
        raise NotImplementedError("Mercado Pago provider not implemented yet")

    def handle_webhook(self, *, headers: dict[str, str], body: bytes) -> ProviderEvent:
        raise NotImplementedError("Mercado Pago webhook not implemented yet")

    def cancel_subscription(self, *, provider_subscription_id: str) -> None:
        raise NotImplementedError("Mercado Pago cancel not implemented yet")
