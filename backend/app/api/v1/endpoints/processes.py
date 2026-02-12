from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Annotated
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.client import Client
from app.models.document import Document
from app.models.enums import TarefaStatus
from app.models.parceria import Parceria
from app.models.process import Process
from app.models.process_movement import ProcessMovement
from app.models.tarefa import Tarefa
from app.models.user import User
from app.schemas.process_movement import (
    ProcessLastMovementCreateOut,
    ProcessLastMovementStatusOut,
)
from app.schemas.process import ProcessCreate, ProcessOut, ProcessUpdate
from app.services.plan_limit_service import PlanLimitService
from app.services.s3_service import S3Service
from app.services.upload_security_service import UploadSecurityService
from app.utils.validators import has_valid_process_cnj_length, only_digits


router = APIRouter()
_logger = logging.getLogger(__name__)
_s3 = S3Service()
_limits = PlanLimitService()
_uploads = UploadSecurityService()
_LAST_MOVEMENT_SOURCE = "process_last_movement"
_PREVIOUS_TASK_NOT_COMPLETED_CODE = "PREVIOUS_TASK_NOT_COMPLETED"
_PREVIOUS_TASK_NOT_COMPLETED_MESSAGE = (
    'Conclua a tarefa anterior e clique em "Excluir" para registrar uma nova movimentação.'
)


def _parse_due_at_iso(value: str) -> datetime:
    raw = value.strip()
    if not raw:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Informe o prazo.")
    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Prazo inválido.") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _normalize_process_numero(raw: str) -> str:
    digits = only_digits(raw)
    if not has_valid_process_cnj_length(digits):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Número do processo incompleto. Informe 20 dígitos.",
        )
    return digits


def _normalize_optional_url(raw: str | None) -> str | None:
    if raw is None:
        return None
    value = raw.strip()
    if not value:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Link do tribunal inválido. Use URL iniciando com http:// ou https://.",
        )
    if not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Link do tribunal inválido. Informe um domínio válido.",
        )
    return value


async def _get_blocking_last_movement_task(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    process_id: uuid.UUID,
) -> Tarefa | None:
    stmt = (
        select(Tarefa)
        .where(Tarefa.tenant_id == tenant_id)
        .where(Tarefa.related_process_id == process_id)
        .where(Tarefa.source == _LAST_MOVEMENT_SOURCE)
        .where(Tarefa.status != TarefaStatus.concluido)
        .order_by(Tarefa.criado_em.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


@router.get("", response_model=list[ProcessOut])
async def list_processes(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    q: str | None = Query(default=None, description="Busca por número/nicho/status"),
    client_id: uuid.UUID | None = Query(default=None, description="Filtrar por cliente"),
    client_name: str | None = Query(default=None, description="Filtrar por nome do cliente"),
    parceria_id: uuid.UUID | None = Query(default=None, description="Filtrar por parceria"),
):
    stmt = (
        select(Process, Client.nome)
        .join(Client, Client.id == Process.client_id)
        .where(Process.tenant_id == user.tenant_id)
        .order_by(Process.criado_em.desc())
    )
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
    if client_name:
        stmt = stmt.where(Client.nome.ilike(f"%{client_name.strip()}%"))
    if parceria_id:
        stmt = stmt.where(Process.parceria_id == parceria_id)
    rows = (await db.execute(stmt)).all()
    out: list[ProcessOut] = []
    for proc, nome in rows:
        base = ProcessOut.model_validate(proc)
        out.append(base.model_copy(update={"client_nome": nome}))
    return out


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
        numero=_normalize_process_numero(payload.numero),
        status=payload.status.value if hasattr(payload.status, "value") else str(payload.status),
        nicho=payload.nicho,
        tribunal_code=payload.tribunal_code.strip().upper() if payload.tribunal_code else None,
        tribunal_login_url=_normalize_optional_url(payload.tribunal_login_url),
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


@router.get("/{process_id}/last-movement/status", response_model=ProcessLastMovementStatusOut)
async def get_process_last_movement_status(
    process_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    process_stmt = select(Process).where(Process.id == process_id).where(Process.tenant_id == user.tenant_id)
    process = (await db.execute(process_stmt)).scalar_one_or_none()
    if not process:
        raise NotFoundError("Processo não encontrado")

    blocking_task = await _get_blocking_last_movement_task(
        db,
        tenant_id=user.tenant_id,
        process_id=process_id,
    )
    if not blocking_task:
        return ProcessLastMovementStatusOut(can_create=True)

    return ProcessLastMovementStatusOut(
        can_create=False,
        blocking_task_id=blocking_task.id,
        blocking_task_title=blocking_task.titulo,
        blocking_due_at=blocking_task.prazo_em,
    )


@router.post("/{process_id}/last-movement", response_model=ProcessLastMovementCreateOut)
async def create_process_last_movement(
    process_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
    title: str = Form(...),
    due_at: str = Form(...),
    client_id: uuid.UUID | None = Form(default=None),
):
    process_stmt = select(Process).where(Process.id == process_id).where(Process.tenant_id == user.tenant_id)
    process = (await db.execute(process_stmt)).scalar_one_or_none()
    if not process:
        raise NotFoundError("Processo não encontrado")

    if client_id is not None and client_id != process.client_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="O cliente informado não corresponde ao processo.",
        )

    linked_client_id = client_id or process.client_id
    client_stmt = select(Client).where(Client.id == linked_client_id).where(Client.tenant_id == user.tenant_id)
    client = (await db.execute(client_stmt)).scalar_one_or_none()
    if not client:
        raise NotFoundError("Cliente não encontrado")

    blocking_task = await _get_blocking_last_movement_task(
        db,
        tenant_id=user.tenant_id,
        process_id=process_id,
    )
    if blocking_task:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": _PREVIOUS_TASK_NOT_COMPLETED_CODE,
                "message": _PREVIOUS_TASK_NOT_COMPLETED_MESSAGE,
            },
        )

    due_at_dt = _parse_due_at_iso(due_at)
    clean_title = title.strip()
    if len(clean_title) < 2:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Informe o título da tarefa.")
    if len(clean_title) > 200:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Título acima do limite de 200 caracteres.")

    file.file.seek(0, 2)
    size_bytes = int(file.file.tell())
    file.file.seek(0)
    safe_filename = _uploads.validate_upload(
        filename=file.filename or "arquivo",
        content_type=file.content_type,
        size_bytes=size_bytes,
    )
    _uploads.scan_upload(fileobj=file.file, filename=safe_filename, content_type=file.content_type)
    await _limits.enforce_storage_limit(db, tenant_id=user.tenant_id, new_file_size_bytes=size_bytes)

    key = _s3.build_tenant_key(tenant_id=str(user.tenant_id), filename=safe_filename)
    _s3.upload_fileobj(key=key, fileobj=file.file, content_type=file.content_type)

    doc = Document(
        tenant_id=user.tenant_id,
        process_id=process_id,
        client_id=linked_client_id,
        categoria="ultima_movimentacao",
        mime_type=file.content_type,
        s3_key=key,
        filename=safe_filename,
        size_bytes=size_bytes,
    )

    try:
        db.add(doc)
        await db.flush()

        task = Tarefa(
            tenant_id=user.tenant_id,
            titulo=clean_title,
            descricao=None,
            status=TarefaStatus.pendente,
            client_id=linked_client_id,
            prazo_em=due_at_dt,
            related_process_id=process_id,
            attachment_document_id=doc.id,
            source=_LAST_MOVEMENT_SOURCE,
            attachment_is_temporary=True,
        )
        db.add(task)
        await db.flush()

        movement = ProcessMovement(
            tenant_id=user.tenant_id,
            client_id=linked_client_id,
            process_id=process_id,
            task_id=task.id,
            title=clean_title,
            due_at=due_at_dt,
            document_id=doc.id,
        )
        db.add(movement)

        await db.commit()
    except Exception:
        await db.rollback()
        try:
            _s3.delete_object(key=key)
        except Exception:  # noqa: BLE001
            _logger.exception("Failed to rollback uploaded last-movement object", extra={"tenant_id": str(user.tenant_id)})
        raise

    await db.refresh(task)
    await db.refresh(movement)
    return ProcessLastMovementCreateOut(ok=True, movement=movement, task=task)


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
        elif key == "numero" and value is not None:
            setattr(proc, key, _normalize_process_numero(value))
        elif key == "tribunal_code":
            setattr(proc, key, value.strip().upper() if value else None)
        elif key == "tribunal_login_url":
            setattr(proc, key, _normalize_optional_url(value))
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
