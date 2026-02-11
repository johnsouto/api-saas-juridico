from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PlanLimitExceeded
from app.models.client import Client
from app.models.document import Document
from app.models.enums import PlanCode, SubscriptionStatus
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _is_plus_effective(sub: Subscription, *, now: datetime) -> bool:
    if sub.status == SubscriptionStatus.active:
        return bool(sub.current_period_end and now <= sub.current_period_end)
    if sub.status == SubscriptionStatus.past_due:
        return bool(sub.grace_period_end and now <= sub.grace_period_end)
    return False


@dataclass(frozen=True)
class PlanLimitService:
    async def _get_effective_limits(self, db: AsyncSession, *, tenant_id: uuid.UUID) -> tuple[PlanCode, int, int | None, int]:
        now = _utcnow()
        sub = (await db.execute(select(Subscription).where(Subscription.tenant_id == tenant_id))).scalar_one_or_none()

        effective_code = sub.plan_code if sub and _is_plus_effective(sub, now=now) else PlanCode.FREE
        plan = (await db.execute(select(Plan).where(Plan.code == effective_code))).scalar_one_or_none()
        if not plan:
            raise PlanLimitExceeded("Plano não encontrado. Rode o seed.")

        max_users = int(plan.max_users)
        max_clients = int(plan.max_clients) if plan.max_clients is not None else None
        max_storage_mb = int(plan.max_storage_mb)

        # Apply per-tenant overrides if present (set by platform admin).
        if sub:
            if sub.max_clients_override is not None:
                max_clients = int(sub.max_clients_override)
            if sub.max_storage_mb_override is not None:
                max_storage_mb = int(sub.max_storage_mb_override)

        return effective_code, max_users, max_clients, max_storage_mb

    async def enforce_user_limit(self, db: AsyncSession, *, tenant_id: uuid.UUID) -> None:
        _, max_users, _, _ = await self._get_effective_limits(db, tenant_id=tenant_id)

        stmt = select(func.count(User.id)).where(User.tenant_id == tenant_id).where(User.is_active.is_(True))
        current = int((await db.execute(stmt)).scalar_one())
        if current >= int(max_users):
            raise PlanLimitExceeded(
                "Upgrade seu plano para adicionar mais usuários",
                code="PLAN_LIMIT_REACHED",
                resource="users",
                limit=int(max_users),
            )

    async def enforce_client_limit(self, db: AsyncSession, *, tenant_id: uuid.UUID) -> None:
        _, _, max_clients, _ = await self._get_effective_limits(db, tenant_id=tenant_id)
        if max_clients is None:
            return

        stmt = (
            select(func.count(Client.id))
            .where(Client.tenant_id == tenant_id)
            .where(Client.is_active.is_(True))
        )
        current = int((await db.execute(stmt)).scalar_one())
        if current >= int(max_clients):
            raise PlanLimitExceeded(
                f"Limite do Plano Free atingido: até {int(max_clients)} clientes. Assine o Plus para cadastrar mais.",
                code="PLAN_LIMIT_REACHED",
                resource="clients",
                limit=int(max_clients),
            )

    async def enforce_storage_limit(self, db: AsyncSession, *, tenant_id: uuid.UUID, new_file_size_bytes: int) -> None:
        _, _, _, max_storage_mb = await self._get_effective_limits(db, tenant_id=tenant_id)

        stmt = select(func.coalesce(func.sum(Document.size_bytes), 0)).where(Document.tenant_id == tenant_id)
        used_bytes = int((await db.execute(stmt)).scalar_one())
        max_bytes = int(max_storage_mb) * 1024 * 1024
        if used_bytes + int(new_file_size_bytes) > max_bytes:
            raise PlanLimitExceeded(
                "Upgrade seu plano para enviar mais documentos",
                code="PLAN_LIMIT_REACHED",
                resource="storage",
                limit=int(max_storage_mb),
            )
