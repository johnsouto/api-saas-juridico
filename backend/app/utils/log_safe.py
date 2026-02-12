from __future__ import annotations

import hashlib

from app.core.config import settings


def safe_identifier(value: str | None) -> str:
    """
    Return a deterministic, non-reversible hash fragment for log correlation.
    """
    raw = (value or "").strip().lower()
    if not raw:
        return "h:empty"
    salted = f"{settings.LOG_PII_HASH_SALT}:{raw}".encode("utf-8")
    digest = hashlib.sha256(salted).hexdigest()[:16]
    return f"h:{digest}"

