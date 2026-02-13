from __future__ import annotations

import asyncio
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.enums import BillingPeriod, BillingProvider, PlanCode, SubscriptionStatus, TenantDocumentoTipo, UserRole
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.tenant import Tenant
from app.models.user import User


async def seed(db: AsyncSession) -> None:
    plans: dict[PlanCode, dict] = {
        PlanCode.FREE: dict(
            nome="Free",
            max_users=3,
            max_clients=3,
            max_storage_mb=100,
            price=Decimal("0.00"),
            price_cents=0,
            currency="BRL",
            billing_period=BillingPeriod.NONE,
        ),
        PlanCode.PLUS_MONTHLY_CARD: dict(
            nome="Plus Mensal (Cartão)",
            max_users=20,
            max_clients=None,
            max_storage_mb=5000,
            price=Decimal("47.00"),
            price_cents=4700,
            currency="BRL",
            billing_period=BillingPeriod.MONTHLY,
        ),
        PlanCode.PLUS_ANNUAL_PIX: dict(
            nome="Plus Anual (Pix)",
            max_users=30,
            max_clients=None,
            max_storage_mb=8000,
            price=Decimal("499.00"),
            price_cents=49900,
            currency="BRL",
            billing_period=BillingPeriod.YEARLY,
        ),
    }

    for code, attrs in plans.items():
        stmt = select(Plan).where(Plan.code == code)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if not existing:
            db.add(Plan(code=code, **attrs))

    await db.commit()

    # Default tenant/admin (dev convenience)
    if settings.ENV != "dev":
        return

    demo_slug = "demo"
    demo_stmt = select(Tenant).where(Tenant.slug == demo_slug)
    tenant = (await db.execute(demo_stmt)).scalar_one_or_none()
    if tenant:
        return

    free_plan = (await db.execute(select(Plan).where(Plan.code == PlanCode.FREE))).scalar_one()

    tenant = Tenant(
        nome="Tenant Demo",
        cnpj="00000000000191",
        tipo_documento=TenantDocumentoTipo.cnpj,
        documento="00000000000191",
        slug=demo_slug,
    )
    db.add(tenant)
    await db.flush()

    admin = User(
        tenant_id=tenant.id,
        nome="Admin Demo",
        first_name="Admin Demo",
        last_name=None,
        email="admin@demo.example.com",
        senha_hash=hash_password("admin12345"),
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
    await db.commit()


async def main() -> None:
    if not settings.SEED_ON_STARTUP:
        return
    async with AsyncSessionLocal() as db:
        await seed(db)


if __name__ == "__main__":
    asyncio.run(main())
