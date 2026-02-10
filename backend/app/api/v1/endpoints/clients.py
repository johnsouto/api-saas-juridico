from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.exceptions import NotFoundError
from app.db.session import get_db
from app.models.client import Client
from app.models.document import Document
from app.models.user import User
from app.schemas.client import ClientCreate, ClientOut, ClientUpdate
from app.schemas.document import DocumentOut
from app.services.plan_limit_service import PlanLimitService
from app.services.s3_service import S3Service


router = APIRouter()
_s3 = S3Service()
_limits = PlanLimitService()


@router.get("", response_model=list[ClientOut])
async def list_clients(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    q: str | None = Query(default=None, description="Busca por nome ou CPF"),
):
    stmt = select(Client).where(Client.tenant_id == user.tenant_id).order_by(Client.criado_em.desc())
    if q:
        stmt = stmt.where(or_(Client.nome.ilike(f"%{q}%"), Client.cpf.ilike(f"%{q}%")))
    return list((await db.execute(stmt)).scalars().all())


@router.post("", response_model=ClientOut)
async def create_client(
    payload: ClientCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    await _limits.enforce_client_limit(db, tenant_id=user.tenant_id)
    client = Client(tenant_id=user.tenant_id, nome=payload.nome, cpf=payload.cpf, dados_contato=payload.dados_contato)
    db.add(client)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CPF já cadastrado") from exc
    await db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientOut)
async def get_client(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Client).where(Client.id == client_id).where(Client.tenant_id == user.tenant_id)
    client = (await db.execute(stmt)).scalar_one_or_none()
    if not client:
        raise NotFoundError("Cliente não encontrado")
    return client


@router.put("/{client_id}", response_model=ClientOut)
async def update_client(
    client_id: uuid.UUID,
    payload: ClientUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Client).where(Client.id == client_id).where(Client.tenant_id == user.tenant_id)
    client = (await db.execute(stmt)).scalar_one_or_none()
    if not client:
        raise NotFoundError("Cliente não encontrado")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, key, value)

    db.add(client)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CPF já cadastrado") from exc

    await db.refresh(client)
    return client


@router.delete("/{client_id}")
async def delete_client(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Client).where(Client.id == client_id).where(Client.tenant_id == user.tenant_id)
    client = (await db.execute(stmt)).scalar_one_or_none()
    if not client:
        raise NotFoundError("Cliente não encontrado")
    await db.delete(client)
    await db.commit()
    return {"message": "Cliente removido"}


@router.get("/{client_id}/documents", response_model=list[DocumentOut])
async def list_client_documents(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    client_stmt = select(Client).where(Client.id == client_id).where(Client.tenant_id == user.tenant_id)
    client = (await db.execute(client_stmt)).scalar_one_or_none()
    if not client:
        raise NotFoundError("Cliente não encontrado")

    stmt = (
        select(Document)
        .where(Document.tenant_id == user.tenant_id)
        .where(Document.client_id == client_id)
        .order_by(Document.criado_em.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


@router.post("/{client_id}/documents/upload", response_model=DocumentOut)
async def upload_client_document(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
    categoria: str | None = Form(default=None),
):
    client_stmt = select(Client).where(Client.id == client_id).where(Client.tenant_id == user.tenant_id)
    client = (await db.execute(client_stmt)).scalar_one_or_none()
    if not client:
        raise NotFoundError("Cliente não encontrado")

    file.file.seek(0, 2)
    size_bytes = int(file.file.tell())
    file.file.seek(0)

    await _limits.enforce_storage_limit(db, tenant_id=user.tenant_id, new_file_size_bytes=size_bytes)

    key = _s3.build_tenant_key(tenant_id=str(user.tenant_id), filename=file.filename or "arquivo")
    _s3.upload_fileobj(key=key, fileobj=file.file, content_type=file.content_type)

    doc = Document(
        tenant_id=user.tenant_id,
        client_id=client_id,
        categoria=categoria,
        mime_type=file.content_type,
        s3_key=key,
        filename=file.filename or "arquivo",
        size_bytes=size_bytes,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc
