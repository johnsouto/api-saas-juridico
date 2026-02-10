from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.client import Client
from app.models.parceria import Parceria
from app.models.process import Process
from app.models.user import User
from app.schemas.process import ProcessCreate, ProcessOut, ProcessUpdate


router = APIRouter()


@router.get("", response_model=list[ProcessOut])
async def list_processes(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    q: str | None = Query(default=None, description="Busca por número/nicho/status"),
    client_id: uuid.UUID | None = Query(default=None, description="Filtrar por cliente"),
    parceria_id: uuid.UUID | None = Query(default=None, description="Filtrar por parceria"),
):
    stmt = select(Process).where(Process.tenant_id == user.tenant_id).order_by(Process.criado_em.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(
                Process.numero.ilike(like),
                Process.nicho.ilike(like),
                Process.status.ilike(like),
            )
        )
    if client_id:
        stmt = stmt.where(Process.client_id == client_id)
    if parceria_id:
        stmt = stmt.where(Process.parceria_id == parceria_id)
    return list((await db.execute(stmt)).scalars().all())


@router.post("", response_model=ProcessOut)
async def create_process(
    payload: ProcessCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    client_stmt = select(Client).where(Client.id == payload.client_id).where(Client.tenant_id == user.tenant_id)
    client = (await db.execute(client_stmt)).scalar_one_or_none()
    if not client:
        raise NotFoundError("Cliente não encontrado")

    if payload.parceria_id is not None:
        parceria_stmt = select(Parceria).where(Parceria.id == payload.parceria_id).where(Parceria.tenant_id == user.tenant_id)
        parceria = (await db.execute(parceria_stmt)).scalar_one_or_none()
        if not parceria:
            raise NotFoundError("Parceria não encontrada")

    proc = Process(
        tenant_id=user.tenant_id,
        client_id=payload.client_id,
        parceria_id=payload.parceria_id,
        numero=payload.numero,
        status=payload.status.value if hasattr(payload.status, "value") else str(payload.status),
        nicho=payload.nicho,
    )
    db.add(proc)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Número do processo já cadastrado") from exc
    await db.refresh(proc)
    return proc


@router.get("/{process_id}", response_model=ProcessOut)
async def get_process(
    process_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Process).where(Process.id == process_id).where(Process.tenant_id == user.tenant_id)
    proc = (await db.execute(stmt)).scalar_one_or_none()
    if not proc:
        raise NotFoundError("Processo não encontrado")
    return proc


@router.put("/{process_id}", response_model=ProcessOut)
async def update_process(
    process_id: uuid.UUID,
    payload: ProcessUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Process).where(Process.id == process_id).where(Process.tenant_id == user.tenant_id)
    proc = (await db.execute(stmt)).scalar_one_or_none()
    if not proc:
        raise NotFoundError("Processo não encontrado")

    if payload.client_id is not None:
        client_stmt = select(Client).where(Client.id == payload.client_id).where(Client.tenant_id == user.tenant_id)
        client = (await db.execute(client_stmt)).scalar_one_or_none()
        if not client:
            raise NotFoundError("Cliente não encontrado")
        proc.client_id = payload.client_id

    if "parceria_id" in payload.model_fields_set and payload.parceria_id is not None:
        parceria_stmt = (
            select(Parceria).where(Parceria.id == payload.parceria_id).where(Parceria.tenant_id == user.tenant_id)
        )
        parceria = (await db.execute(parceria_stmt)).scalar_one_or_none()
        if not parceria:
            raise NotFoundError("Parceria não encontrada")

    for key, value in payload.model_dump(exclude_unset=True, exclude={"client_id"}).items():
        if key == "status" and value is not None:
            setattr(proc, key, value.value if hasattr(value, "value") else str(value))
        else:
            setattr(proc, key, value)

    db.add(proc)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Número do processo já cadastrado") from exc
    await db.refresh(proc)
    return proc


@router.delete("/{process_id}")
async def delete_process(
    process_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Process).where(Process.id == process_id).where(Process.tenant_id == user.tenant_id)
    proc = (await db.execute(stmt)).scalar_one_or_none()
    if not proc:
        raise NotFoundError("Processo não encontrado")
    await db.delete(proc)
    await db.commit()
    return {"message": "Processo removido"}
