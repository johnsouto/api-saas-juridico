from __future__ import annotations

import uuid
from types import SimpleNamespace

import httpx
import pytest

from app.api.v1.endpoints import auth as auth_endpoint


@pytest.mark.asyncio
async def test_register_requires_terms_acceptance(api_client: httpx.AsyncClient):
    payload = {
        "tenant_nome": "Escritorio Teste",
        "tenant_tipo_documento": "cnpj",
        "tenant_documento": "12345678000195",
        "tenant_slug": f"teste-{uuid.uuid4().hex[:8]}",
        "first_name": "Maria",
        "last_name": "Silva",
        "admin_email": f"consent-{uuid.uuid4().hex[:8]}@example.com",
        "admin_senha": "Senha12!A",
        "accept_terms": False,
        "marketing_opt_in": True,
        "terms_version": "2026-02-15",
        "privacy_version": "2026-02-15",
        "consent_source": "register_form",
    }

    response = await api_client.post("/api/v1/auth/register-tenant", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "É necessário aceitar os Termos de Uso e a Política de Privacidade."


@pytest.mark.asyncio
async def test_register_passes_consent_payload_to_service(monkeypatch: pytest.MonkeyPatch, api_client: httpx.AsyncClient):
    captured: dict[str, object] = {}

    async def fake_register_tenant(self, db, background, **kwargs):  # noqa: ANN001
        captured.update(kwargs)
        tenant = SimpleNamespace(
            id=uuid.uuid4(),
            nome=kwargs["tenant_nome"],
            documento=kwargs["tenant_documento"],
        )
        admin = SimpleNamespace(id=uuid.uuid4(), tenant_id=uuid.uuid4())
        return tenant, admin, "access-token", "refresh-token"

    monkeypatch.setattr(type(auth_endpoint._auth_service), "register_tenant", fake_register_tenant)

    payload = {
        "tenant_nome": "Escritorio Teste",
        "tenant_tipo_documento": "cnpj",
        "tenant_documento": "12345678000195",
        "tenant_slug": f"teste-{uuid.uuid4().hex[:8]}",
        "first_name": "Maria",
        "last_name": "Silva",
        "admin_email": f"consent-{uuid.uuid4().hex[:8]}@example.com",
        "admin_senha": "Senha12!A",
        "accept_terms": True,
        "marketing_opt_in": False,
        "terms_version": "2026-02-15",
        "privacy_version": "2026-02-15",
        "consent_source": "register_form",
    }

    response = await api_client.post(
        "/api/v1/auth/register-tenant",
        json=payload,
        headers={"x-forwarded-for": "203.0.113.10", "user-agent": "pytest-agent"},
    )
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert captured["consent_accept_terms"] is True
    assert captured["consent_marketing_opt_in"] is False
    assert captured["consent_terms_version"] == "2026-02-15"
    assert captured["consent_privacy_version"] == "2026-02-15"
    assert captured["consent_source"] == "register_form"
    assert captured["consent_ip_address"] == "203.0.113.10"
    assert captured["consent_user_agent"] == "pytest-agent"
