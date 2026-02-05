from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.plan import Plan
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.plan import PlanOut
from app.schemas.subscription import SubscriptionOut


router = APIRouter()


@router.get("", response_model=list[PlanOut])
async def list_plans(db: Annotated[AsyncSession, Depends(get_db)]):
    stmt = select(Plan).order_by(Plan.price.asc())
    return list((await db.execute(stmt)).scalars().all())


@router.get("/current", response_model=SubscriptionOut)
async def current_subscription(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = (
        select(Subscription)
        .where(Subscription.tenant_id == user.tenant_id)
        .where(Subscription.ativo.is_(True))
        .order_by(Subscription.criado_em.desc())
        .limit(1)
    )
    sub = (await db.execute(stmt)).scalar_one()
    return sub

