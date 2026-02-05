from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.agenda_evento import AgendaEvento
from app.models.client import Client
from app.models.process import Process
from app.models.user import User
from app.schemas.agenda_evento import AgendaEventoCreate, AgendaEventoOut, AgendaEventoUpdate


router = APIRouter()


@router.get("", response_model=list[AgendaEventoOut])
async def list_eventos(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(AgendaEvento).where(AgendaEvento.tenant_id == user.tenant_id).order_by(AgendaEvento.inicio_em.asc())
    return list((await db.execute(stmt)).scalars().all())


@router.post("", response_model=AgendaEventoOut)
async def create_evento(
    payload: AgendaEventoCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if payload.process_id is not None:
        proc_stmt = select(Process).where(Process.id == payload.process_id).where(Process.tenant_id == user.tenant_id)
        proc = (await db.execute(proc_stmt)).scalar_one_or_none()
        if not proc:
            raise NotFoundError("Processo não encontrado")

    if payload.client_id is not None:
        client_stmt = select(Client).where(Client.id == payload.client_id).where(Client.tenant_id == user.tenant_id)
        client = (await db.execute(client_stmt)).scalar_one_or_none()
        if not client:
            raise NotFoundError("Cliente não encontrado")

    ev = AgendaEvento(
        tenant_id=user.tenant_id,
        process_id=payload.process_id,
        client_id=payload.client_id,
        titulo=payload.titulo,
        tipo=payload.tipo,
        inicio_em=payload.inicio_em,
        fim_em=payload.fim_em,
        descricao=payload.descricao,
    )
    db.add(ev)
    await db.commit()
    await db.refresh(ev)
    return ev


@router.put("/{evento_id}", response_model=AgendaEventoOut)
async def update_evento(
    evento_id: uuid.UUID,
    payload: AgendaEventoUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(AgendaEvento).where(AgendaEvento.id == evento_id).where(AgendaEvento.tenant_id == user.tenant_id)
    ev = (await db.execute(stmt)).scalar_one_or_none()
    if not ev:
        raise NotFoundError("Evento não encontrado")

    if "process_id" in payload.model_fields_set and payload.process_id is not None:
        proc_stmt = select(Process).where(Process.id == payload.process_id).where(Process.tenant_id == user.tenant_id)
        proc = (await db.execute(proc_stmt)).scalar_one_or_none()
        if not proc:
            raise NotFoundError("Processo não encontrado")

    if "client_id" in payload.model_fields_set and payload.client_id is not None:
        client_stmt = select(Client).where(Client.id == payload.client_id).where(Client.tenant_id == user.tenant_id)
        client = (await db.execute(client_stmt)).scalar_one_or_none()
        if not client:
            raise NotFoundError("Cliente não encontrado")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(ev, key, value)

    db.add(ev)
    await db.commit()
    await db.refresh(ev)
    return ev


@router.delete("/{evento_id}")
async def delete_evento(
    evento_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(AgendaEvento).where(AgendaEvento.id == evento_id).where(AgendaEvento.tenant_id == user.tenant_id)
    ev = (await db.execute(stmt)).scalar_one_or_none()
    if not ev:
        raise NotFoundError("Evento não encontrado")
    await db.delete(ev)
    await db.commit()
    return {"message": "Evento removido"}
