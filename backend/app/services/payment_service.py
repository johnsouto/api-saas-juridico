from __future__ import annotations

import uuid
from dataclasses import dataclass


@dataclass(frozen=True)
class PaymentProviderResult:
    external_id: str
    status: str


class PaymentProvider:
    def create_subscription(self, *, tenant_id: str, plan_name: str) -> PaymentProviderResult:
        raise NotImplementedError


@dataclass(frozen=True)
class FakePaymentProvider(PaymentProvider):
    """Simula Stripe/MercadoPago via Service Pattern (sem chamadas externas)."""

    provider: str = "fake"

    def create_subscription(self, *, tenant_id: str, plan_name: str) -> PaymentProviderResult:
        return PaymentProviderResult(external_id=f"{self.provider}_{uuid.uuid4()}", status="active")

