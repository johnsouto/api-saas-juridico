from __future__ import annotations

import random
import string

import httpx


def _rand_email(prefix: str = "qa-user") -> str:
    suffix = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(10))
    return f"{prefix}+{suffix}@example.com"


def test_admin_can_list_users(auth_client: httpx.Client):
    r = auth_client.get("/api/v1/users")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_non_admin_forbidden_on_admin_routes(auth_client: httpx.Client, api_config, write_enabled: None):
    # Create a non-admin user via admin API.
    email = _rand_email("qa-advogado")
    password = "Advogado12!"
    payload = {"nome": "QA Advogado", "email": email, "senha": password, "role": "advogado"}
    r = auth_client.post("/api/v1/users", json=payload)
    r.raise_for_status()
    created = r.json()
    user_id = created["id"]

    # Login as the non-admin user (cookie-based session).
    with httpx.Client(base_url=api_config.base_url, timeout=20.0, follow_redirects=True) as c2:
        r2 = c2.post(
            "/api/v1/auth/login",
            data={"username": email, "password": password},
            headers={"content-type": "application/x-www-form-urlencoded"},
        )
        r2.raise_for_status()

        r3 = c2.get("/api/v1/users")
        assert r3.status_code == 403

    # Cleanup: deactivate the user (best-effort).
    auth_client.delete(f"/api/v1/users/{user_id}")

