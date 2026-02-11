from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import BadRequestError, NotFoundError
from app.db.session import get_db
from app.models.parceria import Parceria
from app.models.process import Process
from app.models.user import User
from app.schemas.parceria import ParceriaCreate, ParceriaOut, ParceriaUpdate
from app.schemas.process import ProcessOut


router = APIRouter()


@router.get("", response_model=list[ParceriaOut])
async def list_parcerias(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Parceria).where(Parceria.tenant_id == user.tenant_id).order_by(Parceria.criado_em.desc())
    return list((await db.execute(stmt)).scalars().all())


@router.post("", response_model=ParceriaOut)
async def create_parceria(
    payload: ParceriaCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    parceria = Parceria(
        tenant_id=user.tenant_id,
        nome=payload.nome,
        email=str(payload.email) if payload.email else None,
        telefone=payload.telefone,
        oab_number=payload.oab_number,
        tipo_documento=payload.tipo_documento,
        documento=payload.documento,
    )
    db.add(parceria)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise BadRequestError("CPF/CNPJ já cadastrado para uma parceria.") from exc
    await db.refresh(parceria)
    return parceria


@router.get("/{parceria_id}", response_model=ParceriaOut)
async def get_parceria(
    parceria_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Parceria).where(Parceria.id == parceria_id).where(Parceria.tenant_id == user.tenant_id)
    parceria = (await db.execute(stmt)).scalar_one_or_none()
    if not parceria:
        raise NotFoundError("Parceria não encontrada")
    return parceria


@router.put("/{parceria_id}", response_model=ParceriaOut)
async def update_parceria(
    parceria_id: uuid.UUID,
    payload: ParceriaUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Parceria).where(Parceria.id == parceria_id).where(Parceria.tenant_id == user.tenant_id)
    parceria = (await db.execute(stmt)).scalar_one_or_none()
    if not parceria:
        raise NotFoundError("Parceria não encontrada")

    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "email":
            setattr(parceria, key, str(value) if value else None)
        else:
            setattr(parceria, key, value)
    db.add(parceria)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise BadRequestError("CPF/CNPJ já cadastrado para uma parceria.") from exc
    await db.refresh(parceria)
    return parceria


@router.delete("/{parceria_id}")
async def delete_parceria(
    parceria_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Parceria).where(Parceria.id == parceria_id).where(Parceria.tenant_id == user.tenant_id)
    parceria = (await db.execute(stmt)).scalar_one_or_none()
    if not parceria:
        raise NotFoundError("Parceria não encontrada")
    await db.delete(parceria)
    await db.commit()
    return {"message": "Parceria removida"}


@router.get("/{parceria_id}/processes", response_model=list[ProcessOut])
async def list_processes_for_partner(
    parceria_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = (
        select(Process)
        .where(Process.tenant_id == user.tenant_id)
        .where(Process.parceria_id == parceria_id)
        .order_by(Process.criado_em.desc())
    )
    return list((await db.execute(stmt)).scalars().all())
