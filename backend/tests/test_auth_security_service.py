from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.services.auth_security_service import AuthSecurityService


def _request(ip: str = "127.0.0.1"):
    return SimpleNamespace(
        headers={},
        client=SimpleNamespace(host=ip),
    )


@pytest.mark.asyncio
async def test_rate_limit_blocks_after_threshold(monkeypatch):
    svc = AuthSecurityService()
    req = _request()

    monkeypatch.setattr("app.services.auth_security_service.settings.AUTH_RL_ENABLED", True)
    monkeypatch.setattr("app.services.auth_security_service.settings.AUTH_RL_WINDOW_SEC", 60)
    monkeypatch.setattr("app.services.auth_security_service.settings.AUTH_RL_MAX", 2)
    monkeypatch.setattr("app.services.auth_security_service.settings.ERROR_SCHEMA_ENFORCE_429_413", True)

    svc.enforce_rate_limit(request=req, action="login", principal="user@example.com")
    svc.enforce_rate_limit(request=req, action="login", principal="user@example.com")
    with pytest.raises(HTTPException) as exc:
        svc.enforce_rate_limit(request=req, action="login", principal="user@example.com")
    assert exc.value.status_code == 429
    assert exc.value.detail == "Muitas tentativas. Tente novamente em instantes."


@pytest.mark.asyncio
async def test_lockout_after_failed_attempts(monkeypatch):
    svc = AuthSecurityService()
    req = _request()

    monkeypatch.setattr("app.services.auth_security_service.settings.AUTH_LOCKOUT_ENABLED", True)
    monkeypatch.setattr("app.services.auth_security_service.settings.AUTH_LOCKOUT_MAX_ATTEMPTS", 2)
    monkeypatch.setattr("app.services.auth_security_service.settings.AUTH_LOCKOUT_MINUTES", 10)

    email = "user@example.com"
    svc.record_login_failure(request=req, email=email)
    svc.record_login_failure(request=req, email=email)

    with pytest.raises(HTTPException) as exc:
        svc.enforce_login_lockout(request=req, email=email)
    assert exc.value.status_code == 429
    assert exc.value.detail == "Muitas tentativas. Tente novamente em instantes."
