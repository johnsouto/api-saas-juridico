from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.client import Client
from app.models.document import Document
from app.models.process_movement import ProcessMovement
from app.models.tarefa import Tarefa
from app.models.user import User
from app.schemas.tarefa import TarefaCreate, TarefaOut, TarefaUpdate
from app.services.s3_service import S3Service


router = APIRouter()
_logger = logging.getLogger(__name__)
_s3 = S3Service()


@router.get("", response_model=list[TarefaOut])
async def list_tarefas(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Tarefa).where(Tarefa.tenant_id == user.tenant_id).order_by(Tarefa.criado_em.desc())
    return list((await db.execute(stmt)).scalars().all())


@router.post("", response_model=TarefaOut)
async def create_tarefa(
    payload: TarefaCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    if payload.client_id is not None:
        client_stmt = select(Client).where(Client.id == payload.client_id).where(Client.tenant_id == user.tenant_id)
        client = (await db.execute(client_stmt)).scalar_one_or_none()
        if not client:
            raise NotFoundError("Cliente não encontrado")

    tarefa = Tarefa(
        tenant_id=user.tenant_id,
        titulo=payload.titulo,
        descricao=payload.descricao,
        status=payload.status,
        responsavel_id=payload.responsavel_id,
        client_id=payload.client_id,
        prazo_em=payload.prazo_em,
    )
    db.add(tarefa)
    await db.commit()
    await db.refresh(tarefa)
    return tarefa


@router.put("/{tarefa_id}", response_model=TarefaOut)
async def update_tarefa(
    tarefa_id: uuid.UUID,
    payload: TarefaUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Tarefa).where(Tarefa.id == tarefa_id).where(Tarefa.tenant_id == user.tenant_id)
    tarefa = (await db.execute(stmt)).scalar_one_or_none()
    if not tarefa:
        raise NotFoundError("Tarefa não encontrada")

    if "client_id" in payload.model_fields_set and payload.client_id is not None:
        client_stmt = select(Client).where(Client.id == payload.client_id).where(Client.tenant_id == user.tenant_id)
        client = (await db.execute(client_stmt)).scalar_one_or_none()
        if not client:
            raise NotFoundError("Cliente não encontrado")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(tarefa, key, value)
    db.add(tarefa)
    await db.commit()
    await db.refresh(tarefa)
    return tarefa


@router.delete("/{tarefa_id}")
async def delete_tarefa(
    tarefa_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Tarefa).where(Tarefa.id == tarefa_id).where(Tarefa.tenant_id == user.tenant_id)
    tarefa = (await db.execute(stmt)).scalar_one_or_none()
    if not tarefa:
        raise NotFoundError("Tarefa não encontrada")

    should_cleanup_temp_attachment = (
        tarefa.source == "process_last_movement"
        and tarefa.attachment_is_temporary
        and tarefa.attachment_document_id is not None
    )
    attachment_document_id = tarefa.attachment_document_id

    await db.delete(tarefa)
    await db.flush()

    temp_attachment_removed = False
    if should_cleanup_temp_attachment and attachment_document_id is not None:
        await db.execute(
            update(ProcessMovement)
            .where(ProcessMovement.tenant_id == user.tenant_id)
            .where(ProcessMovement.task_id == tarefa_id)
            .values(task_id=None)
        )
        await db.execute(
            update(ProcessMovement)
            .where(ProcessMovement.tenant_id == user.tenant_id)
            .where(ProcessMovement.document_id == attachment_document_id)
            .values(document_id=None)
        )

        doc_stmt = select(Document).where(Document.id == attachment_document_id).where(Document.tenant_id == user.tenant_id)
        doc = (await db.execute(doc_stmt)).scalar_one_or_none()
        if doc:
            try:
                _s3.delete_object(key=doc.s3_key)
            except Exception:  # noqa: BLE001
                _logger.exception(
                    "Failed to delete temporary movement attachment from storage",
                    extra={"tenant_id": str(user.tenant_id), "document_id": str(doc.id), "task_id": str(tarefa_id)},
                )
            await db.delete(doc)
            temp_attachment_removed = True

    await db.commit()
    return {
        "message": "Tarefa removida",
        "temporary_attachment_removed": temp_attachment_removed,
    }
