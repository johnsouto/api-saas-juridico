from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.exceptions import BadRequestError, NotFoundError
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.tenant_export import TenantExport
from app.models.user import User
from app.schemas.export import TenantExportRequestOut, TenantExportStatusOut
from app.services.action_audit_service import log_security_action
from app.services.export_service import (
    EXPORT_STATUS_EXPIRED,
    EXPORT_STATUS_FAILED,
    EXPORT_STATUS_PENDING,
    EXPORT_STATUS_READY,
    EXPORT_STATUS_RUNNING,
    ExportRateLimitError,
    TenantExportService,
)
from app.services.s3_service import S3Service


router = APIRouter()
_exports = TenantExportService()
_s3 = S3Service()


@router.post("/tenant", response_model=TenantExportRequestOut)
async def request_tenant_export(
    request: Request,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    try:
        exp = await _exports.request_export(
            db,
            tenant_id=user.tenant_id,
            requested_by_user_id=user.id,
            note=None,
            enforce_rate_limit=True,
        )
    except ExportRateLimitError as exc:
        await log_security_action(
            db,
            action="EXPORT_REQUESTED",
            user=user,
            tenant_id=user.tenant_id,
            request=request,
            metadata={
                "rate_limited": True,
                "retry_after_seconds": exc.retry_after_seconds,
                "latest_export_id": exc.latest_export.id if exc.latest_export else None,
            },
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "message": "Você já solicitou uma exportação completa nas últimas 24 horas.",
                "retry_after_seconds": exc.retry_after_seconds,
                "latest_export_id": str(exc.latest_export.id) if exc.latest_export else None,
            },
        ) from exc

    await log_security_action(
        db,
        action="EXPORT_REQUESTED",
        user=user,
        tenant_id=user.tenant_id,
        request=request,
        metadata={"export_id": exp.id, "status": exp.status},
    )
    await db.commit()
    background.add_task(_exports.generate_export_background, exp.id)
    return TenantExportRequestOut(export_id=exp.id, status=exp.status, expires_at=exp.expires_at)


@router.get("/tenant/{export_id}/status", response_model=TenantExportStatusOut)
async def tenant_export_status(
    export_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    exp = await _exports.get_export_for_tenant(db, export_id=export_id, tenant_id=user.tenant_id)
    exp = await _exports.mark_expired_if_needed(db, exp=exp)
    return TenantExportStatusOut(
        export_id=exp.id,
        status=exp.status,
        created_at=exp.criado_em,
        started_at=exp.started_at,
        finished_at=exp.finished_at,
        expires_at=exp.expires_at,
        file_size_bytes=exp.file_size_bytes,
        error_message=exp.error_message,
        downloaded_at=exp.downloaded_at,
        email_sent_at=exp.email_sent_at,
        note=exp.note,
    )


@router.get("/tenant/{export_id}/download")
async def tenant_export_download(
    export_id: uuid.UUID,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    exp = await _exports.get_export_for_tenant(db, export_id=export_id, tenant_id=user.tenant_id)
    exp = await _exports.mark_expired_if_needed(db, exp=exp)
    if exp.status != EXPORT_STATUS_READY:
        if exp.status == EXPORT_STATUS_EXPIRED:
            raise BadRequestError("Exportação expirada.")
        if exp.status in (EXPORT_STATUS_PENDING, EXPORT_STATUS_RUNNING):
            raise BadRequestError("Exportação ainda está em processamento.")
        if exp.status == EXPORT_STATUS_FAILED:
            raise BadRequestError("Exportação falhou. Solicite novamente.")
        raise BadRequestError("Exportação indisponível.")
    if not exp.file_key:
        raise BadRequestError("Arquivo de exportação indisponível.")
    if exp.expires_at < datetime.now(timezone.utc):
        exp.status = EXPORT_STATUS_EXPIRED
        db.add(exp)
        await db.commit()
        raise BadRequestError("Exportação expirada.")

    exp.downloaded_at = datetime.now(timezone.utc)
    db.add(exp)
    await log_security_action(
        db,
        action="EXPORT_DOWNLOADED",
        user=user,
        tenant_id=user.tenant_id,
        request=request,
        metadata={"export_id": exp.id},
    )
    await db.commit()

    signed = _s3.generate_presigned_get_url(key=exp.file_key, expires_in=900)
    return RedirectResponse(url=signed, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@router.get("/tenant/{export_id}/confirm-email", response_class=HTMLResponse)
async def tenant_export_confirm_email(
    export_id: uuid.UUID,
    token: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    exp = (await db.execute(select(TenantExport).where(TenantExport.id == export_id))).scalar_one_or_none()
    if not exp:
        raise NotFoundError("Exportação não encontrada")
    if token != exp.email_confirm_token:
        raise BadRequestError("Token inválido")

    if exp.email_confirmed_at is None:
        xff = request.headers.get("x-forwarded-for")
        ip = xff.split(",")[0].strip() if xff else (request.client.host if request.client else None)
        exp.email_confirmed_at = datetime.now(timezone.utc)
        exp.email_confirmed_ip = (ip or "")[:64] or None
        db.add(exp)
        await log_security_action(
            db,
            action="EXPORT_EMAIL_CONFIRMED",
            user=None,
            tenant_id=exp.tenant_id,
            request=request,
            metadata={"export_id": exp.id},
        )
        await db.commit()

    return HTMLResponse(
        content=(
            "<!doctype html><html lang='pt-BR'><head><meta charset='utf-8'/>"
            "<title>Confirmação registrada</title></head>"
            "<body style='font-family:Arial,sans-serif;padding:24px;'>"
            "<h1>✅ Confirmação registrada</h1>"
            "<p>Obrigado! Você pode fechar esta página.</p>"
            "</body></html>"
        )
    )
