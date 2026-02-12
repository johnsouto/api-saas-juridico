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
from app.models.client_case import ClientCase
from app.models.document import Document
from app.models.parceria import Parceria
from app.models.process import Process
from app.models.user import User
from app.schemas.client import ClientCreate, ClientDetailsOut, ClientOut, ClientUpdate
from app.schemas.client_case import ClientCaseCreate, ClientCaseOut, ClientCaseUpdate
from app.schemas.document import DocumentOut
from app.services.plan_limit_service import PlanLimitService
from app.services.s3_service import S3Service
from app.services.upload_security_service import UploadSecurityService
from app.utils.validators import (
    has_valid_cep_length,
    has_valid_cnpj_length,
    has_valid_cpf_length,
    has_valid_phone_length,
    is_allowed_document_category,
    normalize_document_category,
    only_digits,
)


router = APIRouter()
_s3 = S3Service()
_limits = PlanLimitService()
_uploads = UploadSecurityService()


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text or None


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
    if payload.tipo_documento == "cpf" and not has_valid_cpf_length(documento):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="CPF incompleto. Informe 11 dígitos.")
    if payload.tipo_documento == "cnpj" and not has_valid_cnpj_length(documento):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="CNPJ incompleto. Informe 14 dígitos.")
    address_zip = None
    if payload.address_zip:
        zip_digits = only_digits(payload.address_zip)
        if not has_valid_cep_length(zip_digits):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="CEP incompleto. Informe 8 dígitos.",
            )
        address_zip = zip_digits

    phone_mobile = None
    if payload.phone_mobile:
        phone_digits = only_digits(payload.phone_mobile)
        if not has_valid_phone_length(phone_digits):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Telefone incompleto. Informe DDD + número com 11 dígitos.",
            )
        phone_mobile = phone_digits

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
            existing.phone_mobile = phone_mobile
            existing.email = str(payload.email).strip().lower() if payload.email else None
            existing.address_street = payload.address_street
            existing.address_number = payload.address_number
            existing.address_complement = payload.address_complement
            existing.address_neighborhood = payload.address_neighborhood
            existing.address_city = payload.address_city
            existing.address_state = (payload.address_state or None)
            existing.address_zip = address_zip
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
        phone_mobile=phone_mobile,
        email=str(payload.email).strip().lower() if payload.email else None,
        address_street=payload.address_street,
        address_number=payload.address_number,
        address_complement=payload.address_complement,
        address_neighborhood=payload.address_neighborhood,
        address_city=payload.address_city,
        address_state=(payload.address_state or None),
        address_zip=address_zip,
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
            tipo_doc = payload.tipo_documento or client.tipo_documento
            digits = only_digits(value) if value else value
            if tipo_doc == "cpf" and not has_valid_cpf_length(digits or ""):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="CPF incompleto. Informe 11 dígitos.",
                )
            if tipo_doc == "cnpj" and not has_valid_cnpj_length(digits or ""):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="CNPJ incompleto. Informe 14 dígitos.",
                )
            setattr(client, key, digits)
        elif key == "phone_mobile":
            if value:
                digits = only_digits(value)
                if not has_valid_phone_length(digits):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="Telefone incompleto. Informe DDD + número com 11 dígitos.",
                    )
                setattr(client, key, digits)
            else:
                setattr(client, key, None)
        elif key == "email":
            setattr(client, key, str(value).strip().lower() if value else None)
        elif key == "address_zip":
            if value:
                zip_digits = only_digits(value)
                if not has_valid_cep_length(zip_digits):
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="CEP incompleto. Informe 8 dígitos.",
                    )
                setattr(client, key, zip_digits)
            else:
                setattr(client, key, None)
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


@router.get("/{client_id}/cases", response_model=list[ClientCaseOut])
async def list_client_cases(
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
        select(ClientCase)
        .where(ClientCase.tenant_id == user.tenant_id)
        .where(ClientCase.client_id == client_id)
        .order_by(ClientCase.criado_em.asc())
    )
    return list((await db.execute(stmt)).scalars().all())


@router.post("/{client_id}/cases", response_model=ClientCaseOut, status_code=status.HTTP_201_CREATED)
async def create_client_case(
    client_id: uuid.UUID,
    payload: ClientCaseCreate,
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

    case = ClientCase(
        tenant_id=user.tenant_id,
        client_id=client_id,
        title=_normalize_optional_text(payload.title),
        content=payload.content.strip(),
    )
    db.add(case)
    await db.commit()
    await db.refresh(case)
    return case


@router.patch("/{client_id}/cases/{case_id}", response_model=ClientCaseOut)
async def update_client_case(
    client_id: uuid.UUID,
    case_id: uuid.UUID,
    payload: ClientCaseUpdate,
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

    case_stmt = (
        select(ClientCase)
        .where(ClientCase.id == case_id)
        .where(ClientCase.client_id == client_id)
        .where(ClientCase.tenant_id == user.tenant_id)
    )
    case = (await db.execute(case_stmt)).scalar_one_or_none()
    if not case:
        raise NotFoundError("Caso concreto não encontrado")

    data = payload.model_dump(exclude_unset=True)
    if "title" in data:
        case.title = _normalize_optional_text(payload.title)
    if "content" in data and payload.content is not None:
        case.content = payload.content.strip()

    db.add(case)
    await db.commit()
    await db.refresh(case)
    return case


@router.delete("/{client_id}/cases/{case_id}")
async def delete_client_case(
    client_id: uuid.UUID,
    case_id: uuid.UUID,
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

    case_stmt = (
        select(ClientCase)
        .where(ClientCase.id == case_id)
        .where(ClientCase.client_id == client_id)
        .where(ClientCase.tenant_id == user.tenant_id)
    )
    case = (await db.execute(case_stmt)).scalar_one_or_none()
    if not case:
        raise NotFoundError("Caso concreto não encontrado")

    await db.delete(case)
    await db.commit()
    return {"message": "Caso concreto removido"}


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
    if categoria and not is_allowed_document_category(categoria):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Categoria de documento inválida.")
    normalized_categoria = normalize_document_category(categoria)

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
        categoria=normalized_categoria,
        mime_type=file.content_type,
        s3_key=key,
        filename=safe_filename,
        size_bytes=size_bytes,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc
