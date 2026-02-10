from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.bug_report import BugReport
from app.models.user import User
from app.schemas.feedback import BugReportCreate, BugReportOut
from app.services.email_service import EmailService


router = APIRouter()
_email = EmailService()


@router.post("/bug", response_model=BugReportOut)
async def report_bug(
    payload: BugReportCreate,
    request: Request,
    background: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    """
    Store a bug report (and optionally notify the operator by email).

    This endpoint is intended for authenticated users inside the tenant dashboard.
    """
    url = payload.url
    if url and len(url) > 500:
        url = url[:500]

    user_agent = payload.user_agent or request.headers.get("user-agent")
    if user_agent and len(user_agent) > 500:
        user_agent = user_agent[:500]

    br = BugReport(
        tenant_id=user.tenant_id,
        user_id=user.id,
        title=payload.title.strip(),
        description=payload.description.strip(),
        url=url,
        user_agent=user_agent,
    )
    db.add(br)
    await db.commit()
    await db.refresh(br)

    # Optional operator notification: send to the configured SMTP username (usually the SaaS owner inbox).
    if settings.SMTP_USERNAME:
        subject = f"[Elemento Juris] Bug report — {br.title}"
        body = "\n".join(
            [
                "Novo bug report recebido.",
                "",
                f"Tenant ID: {br.tenant_id}",
                f"User ID: {br.user_id}",
                f"URL: {br.url or '-'}",
                "",
                f"Título: {br.title}",
                "",
                "Descrição:",
                br.description,
                "",
                f"User-Agent: {br.user_agent or '-'}",
            ]
        )
        _email.send_generic_email(background, to_emails=[settings.SMTP_USERNAME], subject=subject, body=body)

    return br

