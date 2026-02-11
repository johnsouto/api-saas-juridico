from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import iterate_in_threadpool
from starlette.responses import StreamingResponse

from app.api.deps import get_current_user
from app.core.exceptions import NotFoundError, PlanLimitExceeded
from app.db.session import get_db
from app.models.client import Client
from app.models.document import Document
from app.models.honorario import Honorario
from app.models.process import Process
from app.models.user import User
from app.schemas.document import DocumentOut, PresignedUrlOut
from app.services.plan_limit_service import PlanLimitService
from app.services.s3_service import S3Service
from app.services.upload_security_service import UploadSecurityService


router = APIRouter()
_s3 = S3Service()
_limits = PlanLimitService()
_uploads = UploadSecurityService()


@router.get("", response_model=list[DocumentOut])
async def list_documents(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    q: str | None = None,
    process_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
    honorario_id: uuid.UUID | None = None,
    categoria: str | None = None,
):
    stmt = select(Document).where(Document.tenant_id == user.tenant_id).order_by(Document.criado_em.desc())
    if q:
        stmt = stmt.where(Document.filename.ilike(f"%{q}%"))
    if process_id:
        stmt = stmt.where(Document.process_id == process_id)
    if client_id:
        stmt = stmt.where(Document.client_id == client_id)
    if honorario_id:
        stmt = stmt.where(Document.honorario_id == honorario_id)
    if categoria:
        stmt = stmt.where(Document.categoria == categoria)
    return list((await db.execute(stmt)).scalars().all())


@router.get("/usage")
async def get_documents_usage(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """
    Return the tenant storage usage in bytes (sum of documents.size_bytes).

    This is useful for dashboards/thermometers on the frontend.
    """
    stmt = select(func.coalesce(func.sum(Document.size_bytes), 0)).where(Document.tenant_id == user.tenant_id)
    used_bytes = int((await db.execute(stmt)).scalar_one())
    return {"used_bytes": used_bytes}


@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    file: UploadFile = File(...),
    process_id: uuid.UUID | None = Form(default=None),
    client_id: uuid.UUID | None = Form(default=None),
    honorario_id: uuid.UUID | None = Form(default=None),
    categoria: str | None = Form(default=None),
):
    if process_id is not None:
        proc_stmt = select(Process).where(Process.id == process_id).where(Process.tenant_id == user.tenant_id)
        proc = (await db.execute(proc_stmt)).scalar_one_or_none()
        if not proc:
            raise NotFoundError("Processo não encontrado")

    if client_id is not None:
        client_stmt = select(Client).where(Client.id == client_id).where(Client.tenant_id == user.tenant_id)
        client = (await db.execute(client_stmt)).scalar_one_or_none()
        if not client:
            raise NotFoundError("Cliente não encontrado")

    if honorario_id is not None:
        hon_stmt = select(Honorario).where(Honorario.id == honorario_id).where(Honorario.tenant_id == user.tenant_id)
        hon = (await db.execute(hon_stmt)).scalar_one_or_none()
        if not hon:
            raise NotFoundError("Honorário não encontrado")

    # Determine size without reading all into memory.
    file.file.seek(0, 2)
    size_bytes = int(file.file.tell())
    file.file.seek(0)
    safe_filename = _uploads.validate_upload(
        filename=file.filename or "arquivo",
        content_type=file.content_type,
        size_bytes=size_bytes,
    )
    _uploads.scan_upload(fileobj=file.file, filename=safe_filename, content_type=file.content_type)

    try:
        await _limits.enforce_storage_limit(db, tenant_id=user.tenant_id, new_file_size_bytes=size_bytes)
    except PlanLimitExceeded as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=exc.message) from exc

    key = _s3.build_tenant_key(tenant_id=str(user.tenant_id), filename=safe_filename)
    _s3.upload_fileobj(key=key, fileobj=file.file, content_type=file.content_type)

    doc = Document(
        tenant_id=user.tenant_id,
        process_id=process_id,
        client_id=client_id,
        honorario_id=honorario_id,
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


@router.get("/{document_id}/download", response_model=PresignedUrlOut)
async def download_document(
    document_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Document).where(Document.id == document_id).where(Document.tenant_id == user.tenant_id)
    doc = (await db.execute(stmt)).scalar_one_or_none()
    if not doc:
        raise NotFoundError("Documento não encontrado")
    url = _s3.generate_presigned_get_url(key=doc.s3_key, expires_in=3600)
    return PresignedUrlOut(url=url, expires_in=3600)


@router.get("/{document_id}/content")
async def get_document_content(
    document_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    disposition: str = "attachment",
):
    """
    Download/visualize a document through the API (proxy).

    This avoids relying on S3_PUBLIC_ENDPOINT_URL / public MinIO exposure.
    Use `?disposition=inline` to hint the browser to preview (PDF/JPEG) instead of downloading.
    """
    stmt = select(Document).where(Document.id == document_id).where(Document.tenant_id == user.tenant_id)
    doc = (await db.execute(stmt)).scalar_one_or_none()
    if not doc:
        raise NotFoundError("Documento não encontrado")

    if disposition not in ("attachment", "inline"):
        disposition = "attachment"

    resp = _s3.get_object(key=doc.s3_key)
    body = resp["Body"]

    def iter_chunks(chunk_size: int = 1024 * 1024):
        try:
            while True:
                chunk = body.read(chunk_size)
                if not chunk:
                    break
                yield chunk
        finally:
            try:
                body.close()
            except Exception:
                pass

    safe_filename = (doc.filename or "arquivo").replace('"', "").replace("\n", " ").replace("\r", " ")
    headers = {
        "Content-Disposition": f'{disposition}; filename="{safe_filename}"',
        "Cache-Control": "no-store",
    }
    media_type = doc.mime_type or resp.get("ContentType") or "application/octet-stream"
    return StreamingResponse(iterate_in_threadpool(iter_chunks()), media_type=media_type, headers=headers)


@router.delete("/{document_id}")
async def delete_document(
    document_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    stmt = select(Document).where(Document.id == document_id).where(Document.tenant_id == user.tenant_id)
    doc = (await db.execute(stmt)).scalar_one_or_none()
    if not doc:
        raise NotFoundError("Documento não encontrado")

    # Best-effort: delete from S3 first, then remove DB record.
    _s3.delete_object(key=doc.s3_key)
    await db.delete(doc)
    await db.commit()
    return {"message": "Documento removido"}
