from __future__ import annotations

import logging
import uuid
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import event
from sqlalchemy.inspection import inspect as sa_inspect
from sqlalchemy.orm import Session as SyncSession

from app.models.audit_log import AuditLog
from app.core.config import settings

_REGISTERED = False
logger = logging.getLogger(__name__)

_SENSITIVE_FIELDS = {
    "senha_hash",
    "token_hash",
    "s3_key",
    "email",
    "documento",
    "cnpj",
    "phone_mobile",
}


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


def _row_snapshot(obj: Any) -> dict[str, Any]:
    insp = sa_inspect(obj)
    data: dict[str, Any] = {}
    for attr in insp.mapper.column_attrs:
        key = attr.key
        if key in _SENSITIVE_FIELDS:
            continue
        data[key] = _to_jsonable(getattr(obj, key))
    return data


def _changed_fields(obj: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    insp = sa_inspect(obj)
    old: dict[str, Any] = {}
    new: dict[str, Any] = {}
    for attr in insp.mapper.column_attrs:
        hist = insp.attrs[attr.key].history
        if not hist.has_changes():
            continue
        if attr.key in _SENSITIVE_FIELDS:
            continue
        old_val = hist.deleted[0] if hist.deleted else None
        new_val = hist.added[0] if hist.added else getattr(obj, attr.key)
        old[attr.key] = _to_jsonable(old_val)
        new[attr.key] = _to_jsonable(new_val)
    return old, new


def _tracked_tables() -> set[str]:
    return settings.csv_set(settings.AUDIT_TRACKED_TABLES)


def _minimal_payload(*, changed_fields: list[str]) -> dict[str, Any]:
    return {"changed_fields": changed_fields}


def register_audit_listeners() -> None:
    global _REGISTERED
    if _REGISTERED:
        return
    _REGISTERED = True

    @event.listens_for(SyncSession, "after_flush")
    def _after_flush(session: SyncSession, flush_context) -> None:  # noqa: ANN001
        try:
            who = session.info.get("actor")
            tenant_id = session.info.get("tenant_id")
            tracked = _tracked_tables()

            def _tenant_uuid() -> uuid.UUID | None:
                if tenant_id is None:
                    return None
                if isinstance(tenant_id, uuid.UUID):
                    return tenant_id
                try:
                    return uuid.UUID(str(tenant_id))
                except Exception:
                    return None

            def _add_log(action: str, obj: Any, old_value: dict[str, Any] | None, new_value: dict[str, Any] | None) -> None:
                if isinstance(obj, AuditLog):
                    return

                table_name = getattr(obj, "__tablename__", obj.__class__.__name__)
                if tracked and table_name not in tracked:
                    return

                record_id = getattr(obj, "id", None)
                log = AuditLog(
                    tenant_id=_tenant_uuid() or getattr(obj, "tenant_id", None),
                    who=str(who)[:200] if who is not None else None,
                    action=action,
                    table_name=table_name,
                    record_id=str(record_id) if record_id is not None else None,
                    old_value=old_value,
                    new_value=new_value,
                    created_at=datetime.now(timezone.utc),
                )
                session.add(log)

            for obj in session.new:
                if settings.AUDIT_MINIMAL_MODE:
                    keys = sorted([k for k in _row_snapshot(obj).keys() if k != "id"])
                    _add_log("CREATE", obj, None, _minimal_payload(changed_fields=keys))
                else:
                    _add_log("CREATE", obj, None, _row_snapshot(obj))

            for obj in session.deleted:
                if settings.AUDIT_MINIMAL_MODE:
                    keys = sorted([k for k in _row_snapshot(obj).keys() if k != "id"])
                    _add_log("DELETE", obj, _minimal_payload(changed_fields=keys), None)
                else:
                    _add_log("DELETE", obj, _row_snapshot(obj), None)

            for obj in session.dirty:
                if not session.is_modified(obj, include_collections=False):
                    continue
                old, new = _changed_fields(obj)
                if not (old or new):
                    continue
                if settings.AUDIT_MINIMAL_MODE:
                    changed = sorted(set(old.keys()) | set(new.keys()))
                    _add_log("UPDATE", obj, None, _minimal_payload(changed_fields=changed))
                else:
                    _add_log("UPDATE", obj, old, new)
        except Exception as exc:  # noqa: BLE001
            # Best-effort auditing must never break the primary transaction flow.
            logger.warning("Audit logging skipped due to internal error: %s", exc)
