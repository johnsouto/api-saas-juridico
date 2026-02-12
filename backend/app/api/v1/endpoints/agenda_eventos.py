from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, time, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.agenda_evento import AgendaEvento
from app.models.client import Client
from app.models.process import Process
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.agenda_evento import AgendaEventoCreate, AgendaEventoCreateOut, AgendaEventoOut, AgendaEventoUpdate
from app.services.calendar_service import format_brasilia_date, format_brasilia_time, generate_ics
from app.services.email_service import EmailService


router = APIRouter()
logger = logging.getLogger(__name__)
_email = EmailService()


def _first_name(user: User) -> str:
    if user.first_name and user.first_name.strip():
        return user.first_name.strip()
    nome = (user.nome or "").strip()
    return nome.split(" ")[0] if nome else "Doutor(a)"


def _build_agenda_email_body(*, user: User, event: AgendaEvento, location: str | None) -> str:
    lines = [
        f"Olá, Dr(a). {_first_name(user)}!",
        "",
        "Seu evento foi cadastrado na Agenda do Elemento Juris.",
        f"📅 Data: {format_brasilia_date(event.inicio_em)}",
        f"⏰ Horário: {format_brasilia_time(event.inicio_em)} (Brasília)",
    ]

    if location:
        lines.append(f"📍 Local: {location}")
    if event.descricao:
        lines.append(f"📝 Detalhes: {event.descricao}")

    lines.extend(
        [
            "",
            "📅 Salvar na agenda: Abra o anexo .ics deste e-mail para adicionar o evento ao seu calendário.",
            "",
            "Este é um e-mail automático (no-reply). Não é necessário responder.",
            "",
            "Obrigado por usar o Elemento Juris.",
            "Atenciosamente,",
            "Equipe Elemento Juris",
        ]
    )
    return "\n".join(lines)


@router.get("", response_model=list[AgendaEventoOut])
async def list_eventos(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    from_date: date | None = Query(default=None, alias="from", description="Data inicial (YYYY-MM-DD)"),
    to_date: date | None = Query(default=None, alias="to", description="Data final (YYYY-MM-DD)"),
):
    stmt = select(AgendaEvento).where(AgendaEvento.tenant_id == user.tenant_id).order_by(AgendaEvento.inicio_em.asc())
    if from_date is not None:
        start_dt = datetime.combine(from_date, time.min, tzinfo=timezone.utc)
        stmt = stmt.where(AgendaEvento.inicio_em >= start_dt)
    if to_date is not None:
        end_dt = datetime.combine(to_date, time.max, tzinfo=timezone.utc)
        stmt = stmt.where(AgendaEvento.inicio_em <= end_dt)
    return list((await db.execute(stmt)).scalars().all())


@router.post("", response_model=AgendaEventoCreateOut)
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

    tenant_stmt = select(Tenant).where(Tenant.id == user.tenant_id)
    tenant = (await db.execute(tenant_stmt)).scalar_one_or_none()
    if tenant is None:
        raise NotFoundError("Escritório não encontrado")

    location = getattr(ev, "location", None) or getattr(ev, "local", None)
    body = _build_agenda_email_body(user=user, event=ev, location=location)
    subject = f"📅 Evento cadastrado — {ev.titulo}"
    email_sent = False
    try:
        ics_bytes = generate_ics(ev, user, tenant)
        email_sent = await run_in_threadpool(
            _email.send_agenda_event_created_email,
            to_email=user.email,
            subject=subject,
            body=body,
            ics_bytes=ics_bytes,
        )
    except Exception:
        logger.exception("Erro ao processar envio de e-mail da agenda")
        email_sent = False

    return {"event": ev, "email_sent": email_sent}


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
