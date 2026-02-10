from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_roles
from app.core.exceptions import AuthError, NotFoundError
from app.core.security import hash_password
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.user import UserCreate, UserOut
from app.services.plan_limit_service import PlanLimitService


router = APIRouter()
_limits = PlanLimitService()


@router.get("", response_model=list[UserOut])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    stmt = select(User).where(User.tenant_id == user.tenant_id).order_by(User.criado_em.desc())
    return list((await db.execute(stmt)).scalars().all())


@router.post("", response_model=UserOut)
async def create_user(
    payload: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    await _limits.enforce_user_limit(db, tenant_id=current.tenant_id)

    new_user = User(
        tenant_id=current.tenant_id,
        nome=payload.nome,
        first_name=payload.nome,
        last_name=None,
        email=str(payload.email),
        senha_hash=hash_password(payload.senha),
        role=payload.role,
    )
    db.add(new_user)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise AuthError("Email já cadastrado") from exc

    await db.refresh(new_user)
    return new_user


@router.delete("/{user_id}")
async def deactivate_user(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    current: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    stmt = select(User).where(User.id == user_id).where(User.tenant_id == current.tenant_id)
    user = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        raise NotFoundError("Usuário não encontrado")
    user.is_active = False
    db.add(user)
    await db.commit()
    return {"message": "Usuário desativado"}
