from __future__ import annotations

import uuid
from dataclasses import dataclass
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PlanLimitExceeded
from app.models.document import Document
from app.models.subscription import Subscription
from app.models.user import User


@dataclass(frozen=True)
class PlanLimitService:
    async def _get_active_subscription(self, db: AsyncSession, *, tenant_id: uuid.UUID) -> Subscription:
        stmt = (
            select(Subscription)
            .where(Subscription.tenant_id == tenant_id)
            .where(Subscription.ativo.is_(True))
            .order_by(Subscription.criado_em.desc())
            .limit(1)
        )
        sub = (await db.execute(stmt)).scalar_one_or_none()
        if not sub:
            raise PlanLimitExceeded("Assinatura não encontrada para este tenant")
        return sub

    async def enforce_user_limit(self, db: AsyncSession, *, tenant_id: uuid.UUID) -> None:
        sub = await self._get_active_subscription(db, tenant_id=tenant_id)
        await db.refresh(sub, attribute_names=["plan"])
        plan = sub.plan

        stmt = select(func.count(User.id)).where(User.tenant_id == tenant_id).where(User.is_active.is_(True))
        current = int((await db.execute(stmt)).scalar_one())
        if current >= plan.max_users:
            raise PlanLimitExceeded("Upgrade seu plano para adicionar mais usuários")

    async def enforce_storage_limit(self, db: AsyncSession, *, tenant_id: uuid.UUID, new_file_size_bytes: int) -> None:
        sub = await self._get_active_subscription(db, tenant_id=tenant_id)
        await db.refresh(sub, attribute_names=["plan"])
        plan = sub.plan

        stmt = select(func.coalesce(func.sum(Document.size_bytes), 0)).where(Document.tenant_id == tenant_id)
        used_bytes = int((await db.execute(stmt)).scalar_one())
        max_bytes = int(plan.max_storage_mb) * 1024 * 1024
        if used_bytes + int(new_file_size_bytes) > max_bytes:
            raise PlanLimitExceeded("Upgrade seu plano para enviar mais documentos")
