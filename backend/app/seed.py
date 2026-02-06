from __future__ import annotations

import asyncio
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.enums import SubscriptionStatus, TenantDocumentoTipo, UserRole
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.tenant import Tenant
from app.models.user import User


async def seed(db: AsyncSession) -> None:
    plans = {
        "Free": dict(max_users=3, max_storage_mb=100, price=Decimal("0.00")),
        "Pro": dict(max_users=20, max_storage_mb=5000, price=Decimal("199.90")),
    }

    for name, attrs in plans.items():
        stmt = select(Plan).where(Plan.nome == name)
        existing = (await db.execute(stmt)).scalar_one_or_none()
        if not existing:
            db.add(Plan(nome=name, **attrs))

    await db.commit()

    # Default tenant/admin (dev convenience)
    if settings.ENV != "dev":
        return

    demo_slug = "demo"
    demo_stmt = select(Tenant).where(Tenant.slug == demo_slug)
    tenant = (await db.execute(demo_stmt)).scalar_one_or_none()
    if tenant:
        return

    free_plan = (await db.execute(select(Plan).where(Plan.nome == "Free"))).scalar_one()

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
        email="admin@demo.local",
        senha_hash=hash_password("admin12345"),
        role=UserRole.admin,
    )
    sub = Subscription(
        tenant_id=tenant.id,
        plan_id=free_plan.id,
        status=SubscriptionStatus.active,
        ativo=True,
        validade=None,
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
