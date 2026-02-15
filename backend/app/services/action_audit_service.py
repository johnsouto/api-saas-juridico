from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.models.user import User


def _to_jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_jsonable(v) for v in value]
    return str(value)


def extract_client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    xff = request.headers.get("x-forwarded-for")
    if xff:
        first = xff.split(",")[0].strip()
        if first:
            return first[:64]
    if request.client and request.client.host:
        return request.client.host[:64]
    return None


def extract_user_agent(request: Request | None) -> str | None:
    if request is None:
        return None
    ua = (request.headers.get("user-agent") or "").strip()
    return ua[:500] if ua else None


async def log_security_action(
    db: AsyncSession,
    *,
    action: str,
    user: User | None,
    tenant_id: uuid.UUID | None,
    request: Request | None,
    metadata: dict[str, Any] | None = None,
) -> None:
    actor = None
    user_id = None
    if user is not None:
        actor = f"{user.role.value}:{user.email}"
        user_id = user.id

    db.add(
        AuditLog(
            tenant_id=tenant_id,
            user_id=user_id,
            who=actor,
            action=action,
            table_name="system",
            record_id=str(tenant_id) if tenant_id else None,
            old_value=None,
            new_value=None,
            metadata_json=_to_jsonable(metadata or {}),
            ip=extract_client_ip(request),
            user_agent=extract_user_agent(request),
        )
    )
