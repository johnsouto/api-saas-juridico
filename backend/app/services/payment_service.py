from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol

import httpx

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
        payer_email: str | None,
        success_url: str,
        cancel_url: str,
    ) -> CheckoutResult:
        raise NotImplementedError

    def handle_webhook(self, *, headers: dict[str, str], body: bytes, query_params: dict[str, str]) -> ProviderEvent:
        raise NotImplementedError

    def cancel_subscription(self, *, provider_subscription_id: str) -> None:
        raise NotImplementedError


def get_payment_provider() -> PaymentProvider:
    """
    Factory for the configured billing provider.
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
        payer_email: str | None,
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

    def handle_webhook(self, *, headers: dict[str, str], body: bytes, query_params: dict[str, str]) -> ProviderEvent:
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
        payer_email: str | None,
        success_url: str,
        cancel_url: str,
    ) -> CheckoutResult:
        raise NotImplementedError("Stripe provider not implemented yet")

    def handle_webhook(self, *, headers: dict[str, str], body: bytes, query_params: dict[str, str]) -> ProviderEvent:
        raise NotImplementedError("Stripe webhook not implemented yet")

    def cancel_subscription(self, *, provider_subscription_id: str) -> None:
        raise NotImplementedError("Stripe cancel not implemented yet")


@dataclass(frozen=True)
class MercadoPagoPaymentProvider:
    provider: BillingProvider = BillingProvider.MERCADOPAGO

    _SUCCESS_STATUSES = {"approved", "authorized", "paid"}
    _FAILURE_STATUSES = {"rejected", "cancelled", "canceled", "refunded", "charged_back"}

    def _require_token(self, *, token: str | None, label: str) -> str:
        resolved = (token or "").strip()
        if not resolved:
            raise ValueError(f"{label} is required")
        return resolved

    def _subscriptions_token(self) -> str:
        return self._require_token(
            token=settings.MERCADOPAGO_ACCESS_TOKEN_SUBSCRIPTIONS or settings.MERCADOPAGO_ACCESS_TOKEN,
            label="MERCADOPAGO_ACCESS_TOKEN_SUBSCRIPTIONS (or MERCADOPAGO_ACCESS_TOKEN)",
        )

    def _checkout_pro_token(self) -> str:
        return self._require_token(
            token=settings.MERCADOPAGO_ACCESS_TOKEN_CHECKOUT_PRO or settings.MERCADOPAGO_ACCESS_TOKEN,
            label="MERCADOPAGO_ACCESS_TOKEN_CHECKOUT_PRO (or MERCADOPAGO_ACCESS_TOKEN)",
        )

    def _api_base(self) -> str:
        return (settings.MERCADOPAGO_API_BASE_URL or "https://api.mercadopago.com").rstrip("/")

    def _headers(self, *, token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _post_json(self, *, path: str, payload: dict[str, Any], token: str) -> dict[str, Any]:
        base = self._api_base()
        url = f"{base}{path}"
        headers = {**self._headers(token=token), "X-Idempotency-Key": str(uuid.uuid4())}
        with httpx.Client(timeout=20.0) as client:
            r = client.post(url, headers=headers, json=payload)
        if r.status_code < 200 or r.status_code >= 300:
            raise ValueError(f"Mercado Pago API error ({r.status_code}): {r.text[:500]}")
        return dict(r.json())

    def _get_json(self, *, path: str, token: str) -> dict[str, Any]:
        base = self._api_base()
        url = f"{base}{path}"
        with httpx.Client(timeout=20.0) as client:
            r = client.get(url, headers=self._headers(token=token))
        if r.status_code < 200 or r.status_code >= 300:
            raise ValueError(f"Mercado Pago API error ({r.status_code}): {r.text[:500]}")
        return dict(r.json())

    def _put_json(self, *, path: str, payload: dict[str, Any], token: str) -> dict[str, Any]:
        base = self._api_base()
        url = f"{base}{path}"
        headers = {**self._headers(token=token), "X-Idempotency-Key": str(uuid.uuid4())}
        with httpx.Client(timeout=20.0) as client:
            r = client.put(url, headers=headers, json=payload)
        if r.status_code < 200 or r.status_code >= 300:
            raise ValueError(f"Mercado Pago API error ({r.status_code}): {r.text[:500]}")
        return dict(r.json())

    def _external_reference(self, *, tenant_id: str, plan_code: PlanCode) -> str:
        return f"tenant_id={tenant_id};plan_code={plan_code.value}"

    def _parse_external_reference(self, external_reference: Any) -> tuple[str, PlanCode | None]:
        raw = str(external_reference or "").strip()
        if not raw:
            raise ValueError("external_reference missing")

        parts: dict[str, str] = {}
        for token in raw.replace("&", ";").split(";"):
            token = token.strip()
            if not token or "=" not in token:
                continue
            k, v = token.split("=", 1)
            parts[k.strip().lower()] = v.strip()

        tenant_id = parts.get("tenant_id") or parts.get("tenant")
        if not tenant_id:
            raise ValueError("tenant_id missing in external_reference")

        plan_raw = parts.get("plan_code") or parts.get("plan")
        plan_code: PlanCode | None = None
        if plan_raw and plan_raw in PlanCode._value2member_map_:  # type: ignore[attr-defined]
            plan_code = PlanCode(plan_raw)

        return tenant_id, plan_code

    def _parse_x_signature(self, x_signature: str) -> tuple[str, str]:
        """
        Mercado Pago x-signature format example:
          ts=1704908010,v1=abcdef...
        """
        ts = ""
        v1 = ""
        for part in (x_signature or "").split(","):
            part = part.strip()
            if not part or "=" not in part:
                continue
            k, v = part.split("=", 1)
            k = k.strip().lower()
            v = v.strip()
            if k == "ts":
                ts = v
            elif k == "v1":
                v1 = v
        if not ts or not v1:
            raise ValueError("Invalid x-signature header")
        return ts, v1

    def _verify_webhook_signature(self, *, headers: dict[str, str], query_params: dict[str, str]) -> None:
        secret = (settings.MERCADOPAGO_WEBHOOK_SECRET or "").strip()
        if not secret:
            return

        x_signature = headers.get("x-signature") or ""
        x_request_id = headers.get("x-request-id") or ""
        if not x_signature or not x_request_id:
            raise ValueError("Missing Mercado Pago signature headers")

        data_id = (
            query_params.get("data.id")
            or query_params.get("data_id")
            or query_params.get("id")
            or ""
        ).strip()
        if not data_id:
            raise ValueError("Missing Mercado Pago data.id")

        ts, expected_v1 = self._parse_x_signature(x_signature)
        # If the data.id is alphanumeric, Mercado Pago expects it lowercased in the manifest.
        data_id = data_id.lower()

        manifest = f"id:{data_id};request-id:{x_request_id};ts:{ts};"
        computed = hmac.new(secret.encode("utf-8"), manifest.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(computed, expected_v1):
            raise ValueError("Invalid Mercado Pago signature")

    def _topic_and_id(self, *, body: dict[str, Any], query_params: dict[str, str]) -> tuple[str, str]:
        topic = (query_params.get("type") or query_params.get("topic") or body.get("type") or body.get("topic") or "").strip()
        data_id = ""
        if isinstance(body.get("data"), dict):
            data_id = str(body["data"].get("id") or "").strip()
        data_id = (query_params.get("data.id") or query_params.get("id") or data_id or "").strip()
        if not topic or not data_id:
            raise ValueError("Invalid Mercado Pago webhook payload (missing topic/id)")
        return topic, data_id

    def _payment_event_type(self, *, status: str, source: str) -> str:
        normalized = (status or "").strip().lower()
        if normalized in self._SUCCESS_STATUSES:
            return "payment_succeeded"
        if normalized in self._FAILURE_STATUSES:
            return "payment_failed"
        return f"{source}_{normalized or 'updated'}"

    def create_checkout(
        self,
        *,
        tenant_id: str,
        plan_code: PlanCode,
        payer_email: str | None,
        success_url: str,
        cancel_url: str,
    ) -> CheckoutResult:
        public_url = (settings.PUBLIC_APP_URL or "").strip().rstrip("/")
        notification_url = f"{public_url}/api/v1/billing/webhook/mercadopago" if public_url.startswith("http") else None
        external_reference = self._external_reference(tenant_id=tenant_id, plan_code=plan_code)

        if plan_code == PlanCode.PLUS_MONTHLY_CARD:
            token = self._subscriptions_token()
            if not payer_email:
                raise ValueError("payer_email is required for Mercado Pago subscriptions")

            payload: dict[str, Any] = {
                "reason": "Elemento Juris — Plus Mensal (Cartão)",
                "external_reference": external_reference,
                "payer_email": payer_email,
                "auto_recurring": {
                    "frequency": 1,
                    "frequency_type": "months",
                    "transaction_amount": 47.00,
                    "currency_id": "BRL",
                },
                # Redirect after the buyer confirms the subscription.
                "back_url": success_url,
                # Let the buyer choose the payment method via Mercado Pago checkout.
                "status": "pending",
            }
            if notification_url:
                payload["notification_url"] = notification_url

            data = self._post_json(path="/preapproval", payload=payload, token=token)

            preapproval_id = str(data.get("id") or "").strip()
            init_point = str(data.get("init_point") or data.get("sandbox_init_point") or "").strip()
            if not preapproval_id or not init_point:
                raise ValueError("Mercado Pago did not return preapproval id/init_point")
            return CheckoutResult(checkout_url=init_point, provider_subscription_id=preapproval_id)

        if plan_code == PlanCode.PLUS_ANNUAL_PIX:
            token = self._checkout_pro_token()
            payload = {
                "items": [
                    {
                        "title": "Elemento Juris — Plus Anual (Pix)",
                        "quantity": 1,
                        "currency_id": "BRL",
                        "unit_price": 499.00,
                    }
                ],
                "external_reference": external_reference,
                "back_urls": {
                    "success": success_url,
                    "pending": success_url,
                    "failure": cancel_url,
                },
                "auto_return": "approved",
                # Pix remains available and pre-selected in Checkout Pro.
                "payment_methods": {
                    "default_payment_method_id": "pix",
                    "installments": 1,
                    "default_installments": 1,
                },
            }
            if payer_email:
                payload["payer"] = {"email": payer_email}
            if notification_url:
                payload["notification_url"] = notification_url

            data = self._post_json(path="/checkout/preferences", payload=payload, token=token)
            preference_id = str(data.get("id") or "").strip()
            init_point = str(data.get("init_point") or data.get("sandbox_init_point") or "").strip()
            if not preference_id or not init_point:
                raise ValueError("Mercado Pago did not return preference id/init_point")
            return CheckoutResult(checkout_url=init_point, provider_payment_id=preference_id)

        raise ValueError("Unsupported plan_code for Mercado Pago")

    def handle_webhook(self, *, headers: dict[str, str], body: bytes, query_params: dict[str, str]) -> ProviderEvent:
        self._verify_webhook_signature(headers=headers, query_params=query_params)
        payload = json.loads(body.decode("utf-8") or "{}")
        if not isinstance(payload, dict):
            raise ValueError("Invalid Mercado Pago webhook body")

        topic, data_id = self._topic_and_id(body=payload, query_params=query_params)
        topic_norm = topic.strip().lower()

        if topic_norm in {"subscription_preapproval", "preapproval"}:
            pre = self._get_json(path=f"/preapproval/{data_id}", token=self._subscriptions_token())
            tenant_id, plan_code = self._parse_external_reference(pre.get("external_reference"))
            status = str(pre.get("status") or "").strip().lower()

            # Minimal/safe payload for auditing (avoid storing payer email).
            safe_payload = {
                "topic": topic,
                "preapproval_id": str(pre.get("id") or data_id),
                "status": status,
                "external_reference": str(pre.get("external_reference") or ""),
                "reason": str(pre.get("reason") or ""),
                "auto_recurring": pre.get("auto_recurring") if isinstance(pre.get("auto_recurring"), dict) else None,
            }

            if status in {"authorized", "active"}:
                return ProviderEvent(
                    provider=self.provider,
                    event_type="payment_succeeded",
                    tenant_id=tenant_id,
                    plan_code=plan_code or PlanCode.PLUS_MONTHLY_CARD,
                    external_id=str(pre.get("id") or data_id),
                    payment_status=status,
                    payload=safe_payload,
                )

            if status in {"cancelled", "canceled"}:
                return ProviderEvent(
                    provider=self.provider,
                    event_type="subscription_canceled",
                    tenant_id=tenant_id,
                    plan_code=plan_code or PlanCode.PLUS_MONTHLY_CARD,
                    external_id=str(pre.get("id") or data_id),
                    payment_status=status,
                    payload=safe_payload,
                )

            return ProviderEvent(
                provider=self.provider,
                event_type=f"subscription_{status or 'updated'}",
                tenant_id=tenant_id,
                plan_code=plan_code or PlanCode.PLUS_MONTHLY_CARD,
                external_id=str(pre.get("id") or data_id),
                payment_status=status or None,
                payload=safe_payload,
            )

        if topic_norm in {"subscription_authorized_payment", "authorized_payment"}:
            auth = self._get_json(path=f"/authorized_payments/{data_id}", token=self._subscriptions_token())
            status = str(auth.get("status") or "").strip().lower()

            # Try to correlate with the subscription.
            preapproval_id = str(
                auth.get("preapproval_id")
                or auth.get("preapprovalId")
                or auth.get("subscription_id")
                or auth.get("subscriptionId")
                or ""
            ).strip()
            if preapproval_id:
                pre = self._get_json(path=f"/preapproval/{preapproval_id}", token=self._subscriptions_token())
                tenant_id, plan_code = self._parse_external_reference(pre.get("external_reference"))
            else:
                tenant_id, plan_code = self._parse_external_reference(auth.get("external_reference"))

            safe_payload = {
                "topic": topic,
                "authorized_payment_id": str(auth.get("id") or data_id),
                "status": status,
                "preapproval_id": preapproval_id or None,
                "external_reference": str(auth.get("external_reference") or ""),
            }

            event_type = self._payment_event_type(status=status, source="authorized_payment")
            return ProviderEvent(
                provider=self.provider,
                event_type=event_type,
                tenant_id=tenant_id,
                plan_code=plan_code or PlanCode.PLUS_MONTHLY_CARD,
                external_id=str(auth.get("id") or data_id),
                payment_status=status or None,
                payload=safe_payload,
            )

        if topic_norm == "payment":
            checkout_token = self._checkout_pro_token()
            pay: dict[str, Any]
            try:
                pay = self._get_json(path=f"/v1/payments/{data_id}", token=checkout_token)
            except ValueError as first_error:
                subscriptions_token = self._subscriptions_token()
                if subscriptions_token == checkout_token:
                    raise
                try:
                    pay = self._get_json(path=f"/v1/payments/{data_id}", token=subscriptions_token)
                except ValueError:
                    raise first_error
            status = str(pay.get("status") or "").strip().lower()

            try:
                tenant_id, plan_code = self._parse_external_reference(pay.get("external_reference"))
            except Exception:
                tenant_id = ""
                plan_code = None

            safe_payload = {
                "topic": topic,
                "payment_id": str(pay.get("id") or data_id),
                "status": status,
                "external_reference": str(pay.get("external_reference") or ""),
                "transaction_amount": pay.get("transaction_amount"),
                "currency_id": pay.get("currency_id"),
            }

            if tenant_id:
                event_type = self._payment_event_type(status=status, source="payment")
                return ProviderEvent(
                    provider=self.provider,
                    event_type=event_type,
                    tenant_id=tenant_id,
                    plan_code=plan_code or PlanCode.PLUS_MONTHLY_CARD,
                    external_id=str(pay.get("id") or data_id),
                    payment_status=status or None,
                    payload=safe_payload,
                )

            raise ValueError("Uncorrelated Mercado Pago payment event (missing external_reference)")

        raise ValueError(f"Unsupported Mercado Pago webhook topic: {topic}")

    def cancel_subscription(self, *, provider_subscription_id: str) -> None:
        sub_id = (provider_subscription_id or "").strip()
        if not sub_id:
            raise ValueError("provider_subscription_id is required")
        self._put_json(path=f"/preapproval/{sub_id}", payload={"status": "cancelled"}, token=self._subscriptions_token())
