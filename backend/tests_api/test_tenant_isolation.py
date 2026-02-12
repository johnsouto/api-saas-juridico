from __future__ import annotations

import httpx
import pytest


def _auth_headers(access_token: str) -> dict[str, str]:
    return {"authorization": f"Bearer {access_token}"}


async def test_tenant_isolation_blocks_cross_tenant_reads(
    platform_admin_key: str,
    api_client: httpx.AsyncClient,
    request: pytest.FixtureRequest,
):
    # Provision 2 tenants via /platform (requires API_ALLOW_WRITE=true + API_SEED_STRATEGY=api).
    t1 = request.getfixturevalue("provisioned_tenant")
    t2 = request.getfixturevalue("provisioned_tenant")

    token1 = t1["tokens"]["access_token"]
    token2 = t2["tokens"]["access_token"]

    # Create a client in tenant 1.
    payload = {"nome": "Cliente QA", "tipo_documento": "cpf", "documento": "12345678909"}
    r = await api_client.post("/api/v1/clients", json=payload, headers=_auth_headers(token1))
    r.raise_for_status()
    client_id = r.json()["id"]

    # Tenant 2 must not see it in the list.
    r2 = await api_client.get("/api/v1/clients", headers=_auth_headers(token2))
    r2.raise_for_status()
    ids = {c["id"] for c in r2.json()}
    assert client_id not in ids

    # Tenant 2 must not fetch it directly.
    r3 = await api_client.get(f"/api/v1/clients/{client_id}", headers=_auth_headers(token2))
    assert r3.status_code == 404
