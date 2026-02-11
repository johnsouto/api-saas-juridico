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
from app.models.parceria import Parceria
from app.models.process import Process
from app.models.user import User
from app.schemas.client import ClientCreate, ClientDetailsOut, ClientOut, ClientUpdate
from app.schemas.document import DocumentOut
from app.services.plan_limit_service import PlanLimitService
from app.services.s3_service import S3Service
from app.services.upload_security_service import UploadSecurityService
from app.utils.validators import only_digits


router = APIRouter()
_s3 = S3Service()
_limits = PlanLimitService()
_uploads = UploadSecurityService()


@router.get("", response_model=list[ClientOut])
async def list_clients(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    q: str | None = Query(default=None, description="Busca por nome ou documento"),
):
    stmt = (
        select(Client)
        .where(Client.tenant_id == user.tenant_id)
        .where(Client.is_active.is_(True))
        .order_by(Client.criado_em.desc())
    )
    if q:
        qnorm = q.strip()
        stmt = stmt.where(or_(Client.nome.ilike(f"%{qnorm}%"), Client.documento.ilike(f"%{qnorm}%")))
    return list((await db.execute(stmt)).scalars().all())


@router.post("", response_model=ClientOut)
async def create_client(
    payload: ClientCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    await _limits.enforce_client_limit(db, tenant_id=user.tenant_id)
    documento = only_digits(payload.documento)

    # If a client with the same document was previously "deleted", reactivate it instead of failing.
    existing_stmt = (
        select(Client)
        .where(Client.tenant_id == user.tenant_id)
        .where(Client.documento == documento)
    )
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            existing.nome = payload.nome
            existing.tipo_documento = payload.tipo_documento
            existing.phone_mobile = payload.phone_mobile
            existing.email = str(payload.email).strip().lower() if payload.email else None
            existing.address_street = payload.address_street
            existing.address_number = payload.address_number
            existing.address_complement = payload.address_complement
            existing.address_neighborhood = payload.address_neighborhood
            existing.address_city = payload.address_city
            existing.address_state = (payload.address_state or None)
            existing.address_zip = payload.address_zip
            db.add(existing)
            await db.commit()
            await db.refresh(existing)
            return existing
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Documento já cadastrado")

    client = Client(
        tenant_id=user.tenant_id,
        nome=payload.nome,
        tipo_documento=payload.tipo_documento,
        documento=documento,
        phone_mobile=payload.phone_mobile,
        email=str(payload.email).strip().lower() if payload.email else None,
        address_street=payload.address_street,
        address_number=payload.address_number,
        address_complement=payload.address_complement,
        address_neighborhood=payload.address_neighborhood,
        address_city=payload.address_city,
        address_state=(payload.address_state or None),
        address_zip=payload.address_zip,
    )
    db.add(client)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Documento já cadastrado") from exc
    await db.refresh(client)
    return client


@router.get("/{client_id}", response_model=ClientOut)
async def get_client(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = (
        select(Client)
        .where(Client.id == client_id)
        .where(Client.tenant_id == user.tenant_id)
        .where(Client.is_active.is_(True))
    )
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
    stmt = (
        select(Client)
        .where(Client.id == client_id)
        .where(Client.tenant_id == user.tenant_id)
        .where(Client.is_active.is_(True))
    )
    client = (await db.execute(stmt)).scalar_one_or_none()
    if not client:
        raise NotFoundError("Cliente não encontrado")

    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "documento":
            setattr(client, key, only_digits(value) if value else value)
        elif key == "email":
            setattr(client, key, str(value).strip().lower() if value else None)
        else:
            setattr(client, key, value)

    db.add(client)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Documento já cadastrado") from exc

    await db.refresh(client)
    return client


@router.delete("/{client_id}")
async def delete_client(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = (
        select(Client)
        .where(Client.id == client_id)
        .where(Client.tenant_id == user.tenant_id)
        .where(Client.is_active.is_(True))
    )
    client = (await db.execute(stmt)).scalar_one_or_none()
    if not client:
        raise NotFoundError("Cliente não encontrado")
    # Soft delete: keeps historical relations (processes, honorarios, docs, etc) intact.
    client.is_active = False
    db.add(client)
    await db.commit()
    return {"message": "Cliente removido"}


@router.get("/{client_id}/documents", response_model=list[DocumentOut])
async def list_client_documents(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    client_stmt = (
        select(Client)
        .where(Client.id == client_id)
        .where(Client.tenant_id == user.tenant_id)
        .where(Client.is_active.is_(True))
    )
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


@router.get("/{client_id}/details", response_model=ClientDetailsOut)
async def get_client_details(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = (
        select(Client)
        .where(Client.id == client_id)
        .where(Client.tenant_id == user.tenant_id)
        .where(Client.is_active.is_(True))
    )
    client = (await db.execute(stmt)).scalar_one_or_none()
    if not client:
        raise NotFoundError("Cliente não encontrado")

    docs_stmt = (
        select(Document)
        .where(Document.tenant_id == user.tenant_id)
        .where(Document.client_id == client_id)
        .order_by(Document.criado_em.desc())
    )
    documents = list((await db.execute(docs_stmt)).scalars().all())

    # Parcerias relacionadas ao cliente via processos.
    partners_stmt = (
        select(Parceria)
        .join(Process, Process.parceria_id == Parceria.id)
        .where(Process.tenant_id == user.tenant_id)
        .where(Process.client_id == client_id)
        .distinct()
        .order_by(Parceria.nome.asc())
    )
    parcerias = list((await db.execute(partners_stmt)).scalars().all())

    return ClientDetailsOut(client=client, parcerias=parcerias, documents=documents)


@router.post("/{client_id}/documents/upload", response_model=DocumentOut)
async def upload_client_document(
    client_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
    categoria: str | None = Form(default=None),
):
    client_stmt = (
        select(Client)
        .where(Client.id == client_id)
        .where(Client.tenant_id == user.tenant_id)
        .where(Client.is_active.is_(True))
    )
    client = (await db.execute(client_stmt)).scalar_one_or_none()
    if not client:
        raise NotFoundError("Cliente não encontrado")

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
        client_id=client_id,
        categoria=categoria,
        mime_type=file.content_type,
        s3_key=key,
        filename=safe_filename,
        size_bytes=size_bytes,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc
