from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User
from app.schemas.account import AccountDeleteRequestIn, AccountDeleteRequestOut
from app.services.account_service import AccountService
from app.services.email_service import EmailService
from app.services.export_service import TenantExportService


router = APIRouter()
_service = AccountService(email_service=EmailService(), export_service=TenantExportService())


@router.post("/delete-request", response_model=AccountDeleteRequestOut)
async def account_delete_request(
    payload: AccountDeleteRequestIn,
    request: Request,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(require_roles(UserRole.admin))],
):
    result = await _service.request_delete(
        db,
        background,
        request=request,
        user=user,
        confirm_text=payload.confirm_text,
        reason=payload.reason,
        reason_text=payload.reason_text,
    )
    return AccountDeleteRequestOut(
        ok=result.ok,
        plan_code=result.plan_code,
        delete_scheduled_for=result.delete_scheduled_for,
        export_requested=result.export_requested,
        export_id=result.export_id,
        export_rate_limited=result.export_rate_limited,
        export_retry_after_seconds=result.export_retry_after_seconds,
        latest_export_id=result.latest_export_id,
    )
