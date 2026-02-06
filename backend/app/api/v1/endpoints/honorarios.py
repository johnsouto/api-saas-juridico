from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import BadRequestError, NotFoundError, PlanLimitExceeded
from app.db.session import get_db
from app.models.client import Client
from app.models.document import Document
from app.models.enums import HonorarioStatus
from app.models.honorario import Honorario
from app.models.process import Process
from app.models.user import User
from app.schemas.honorario import HonorarioCreate, HonorarioOut, HonorarioUpdate
from app.services.plan_limit_service import PlanLimitService
from app.services.s3_service import S3Service


router = APIRouter()
_s3 = S3Service()
_limits = PlanLimitService()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@router.get("", response_model=list[HonorarioOut])
async def list_honorarios(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    process_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
):
    stmt = select(Honorario).where(Honorario.tenant_id == user.tenant_id).order_by(Honorario.criado_em.desc())
    if process_id:
        stmt = stmt.where(Honorario.process_id == process_id)
    if client_id:
        stmt = stmt.where(Honorario.client_id == client_id)
    return list((await db.execute(stmt)).scalars().all())


@router.post("", response_model=HonorarioOut)
async def create_honorario(
    payload: HonorarioCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    client_stmt = select(Client).where(Client.id == payload.client_id).where(Client.tenant_id == user.tenant_id)
    client = (await db.execute(client_stmt)).scalar_one_or_none()
    if not client:
        raise NotFoundError("Cliente não encontrado")

    if payload.process_id is not None:
        proc_stmt = select(Process).where(Process.id == payload.process_id).where(Process.tenant_id == user.tenant_id)
        proc = (await db.execute(proc_stmt)).scalar_one_or_none()
        if not proc:
            raise NotFoundError("Processo não encontrado")
        if proc.client_id != payload.client_id:
            raise BadRequestError("O processo informado não pertence ao cliente selecionado")

    hon = Honorario(
        tenant_id=user.tenant_id,
        client_id=payload.client_id,
        process_id=payload.process_id,
        valor=payload.valor,
        data_vencimento=payload.data_vencimento,
        qtd_parcelas=payload.qtd_parcelas,
        percentual_exito=payload.percentual_exito,
        percentual_parceiro=payload.percentual_parceiro,
        status=payload.status,
    )
    db.add(hon)
    await db.commit()
    await db.refresh(hon)
    return hon


@router.put("/{honorario_id}", response_model=HonorarioOut)
async def update_honorario(
    honorario_id: uuid.UUID,
    payload: HonorarioUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Honorario).where(Honorario.id == honorario_id).where(Honorario.tenant_id == user.tenant_id)
    hon = (await db.execute(stmt)).scalar_one_or_none()
    if not hon:
        raise NotFoundError("Honorário não encontrado")

    fields = payload.model_fields_set

    # Validate new client/process references (when provided).
    new_client_id = hon.client_id
    if "client_id" in fields:
        if payload.client_id is None:
            raise BadRequestError("client_id é obrigatório")
        client_stmt = select(Client).where(Client.id == payload.client_id).where(Client.tenant_id == user.tenant_id)
        client = (await db.execute(client_stmt)).scalar_one_or_none()
        if not client:
            raise NotFoundError("Cliente não encontrado")
        new_client_id = payload.client_id

    new_process_id = hon.process_id
    if "process_id" in fields:
        new_process_id = payload.process_id

    if new_process_id is not None:
        proc_stmt = select(Process).where(Process.id == new_process_id).where(Process.tenant_id == user.tenant_id)
        proc = (await db.execute(proc_stmt)).scalar_one_or_none()
        if not proc:
            raise NotFoundError("Processo não encontrado")
        if proc.client_id != new_client_id:
            raise BadRequestError("O processo informado não pertence ao cliente selecionado")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(hon, key, value)
    db.add(hon)
    await db.commit()
    await db.refresh(hon)
    return hon


@router.delete("/{honorario_id}")
async def delete_honorario(
    honorario_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Honorario).where(Honorario.id == honorario_id).where(Honorario.tenant_id == user.tenant_id)
    hon = (await db.execute(stmt)).scalar_one_or_none()
    if not hon:
        raise NotFoundError("Honorário não encontrado")
    await db.delete(hon)
    await db.commit()
    return {"message": "Honorário removido"}


@router.post("/{honorario_id}/confirm-payment", response_model=HonorarioOut)
async def confirm_payment(
    honorario_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    valor_pago: Decimal | None = Form(default=None),
    meio_pagamento: str = Form(...),
    pago_em: datetime | None = Form(default=None),
    comprovante: UploadFile | None = File(default=None),
):
    stmt = select(Honorario).where(Honorario.id == honorario_id).where(Honorario.tenant_id == user.tenant_id)
    hon = (await db.execute(stmt)).scalar_one_or_none()
    if not hon:
        raise NotFoundError("Honorário não encontrado")

    comprovante_doc: Document | None = None

    if comprovante is not None:
        comprovante.file.seek(0, 2)
        size_bytes = int(comprovante.file.tell())
        comprovante.file.seek(0)

        try:
            await _limits.enforce_storage_limit(db, tenant_id=user.tenant_id, new_file_size_bytes=size_bytes)
        except PlanLimitExceeded as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=exc.message) from exc

        key = _s3.build_tenant_key(tenant_id=str(user.tenant_id), filename=comprovante.filename or "comprovante")
        _s3.upload_fileobj(key=key, fileobj=comprovante.file, content_type=comprovante.content_type)

        comprovante_doc = Document(
            tenant_id=user.tenant_id,
            honorario_id=hon.id,
            categoria="comprovante_pagamento",
            mime_type=comprovante.content_type,
            s3_key=key,
            filename=comprovante.filename or "comprovante",
            size_bytes=size_bytes,
        )
        db.add(comprovante_doc)
        await db.flush()

    hon.status = HonorarioStatus.pago
    hon.pago_em = pago_em or _utcnow()
    hon.valor_pago = valor_pago if valor_pago is not None else hon.valor
    hon.meio_pagamento = meio_pagamento
    if comprovante_doc is not None:
        hon.comprovante_document_id = comprovante_doc.id

    db.add(hon)
    await db.commit()
    await db.refresh(hon)
    return hon
