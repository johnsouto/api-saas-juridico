from __future__ import annotations

import httpx


def test_health(api_client: httpx.Client):
    r = api_client.get("/api/health")
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


def test_login_sets_session_and_me_works(auth_client: httpx.Client, api_config):
    # Cookie-based session should now be active.
    r = auth_client.get("/api/v1/auth/me")
    assert r.status_code == 200
    me = r.json()
    assert me.get("email") == api_config.email
    assert me.get("tenant_id")


def test_tenant_routes_require_auth(api_client: httpx.Client):
    # No auth: should be blocked by get_current_user.
    r = api_client.get("/api/v1/clients")
    assert r.status_code == 401
    assert "detail" in r.json()

