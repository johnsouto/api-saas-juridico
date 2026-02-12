from __future__ import annotations

import httpx


async def test_upload_requires_auth(api_client: httpx.AsyncClient):
    r = await api_client.post(
        "/api/v1/documents/upload",
        files={"file": ("hello.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 401


async def test_upload_download_delete_roundtrip(write_enabled: None, auth_client: httpx.AsyncClient):
    r = await auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("hello.txt", b"hello", "text/plain")},
    )
    r.raise_for_status()
    doc = r.json()
    doc_id = doc["id"]

    r2 = await auth_client.get(f"/api/v1/documents/{doc_id}/download")
    r2.raise_for_status()
    payload = r2.json()
    assert payload.get("url")

    # Cleanup (best-effort).
    await auth_client.delete(f"/api/v1/documents/{doc_id}")
