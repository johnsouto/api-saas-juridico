from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.core.config import settings


TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


@dataclass(frozen=True)
class TurnstileVerifyResult:
    success: bool
    error_codes: list[str]


async def verify_turnstile(token: str, *, remoteip: str | None = None) -> TurnstileVerifyResult:
    """
    Verify a Cloudflare Turnstile token.

    If TURNSTILE_SECRET_KEY is not set, verification is considered disabled and will always succeed.
    """
    secret = settings.TURNSTILE_SECRET_KEY
    if not secret:
        return TurnstileVerifyResult(success=True, error_codes=[])

    # Cloudflare expects form-encoded POST body.
    data: dict[str, str] = {"secret": secret, "response": token}
    if remoteip:
        data["remoteip"] = remoteip

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(TURNSTILE_VERIFY_URL, data=data)
            resp.raise_for_status()
            payload = resp.json()
    except Exception:
        # Fail closed if Turnstile is enabled but verification fails (network/HTTP/parsing).
        return TurnstileVerifyResult(success=False, error_codes=["verify_failed"])

    success = bool(payload.get("success"))
    raw_codes = payload.get("error-codes") or payload.get("error_codes") or []
    error_codes = [str(x) for x in raw_codes] if isinstance(raw_codes, list) else [str(raw_codes)]
    return TurnstileVerifyResult(success=success, error_codes=error_codes)

