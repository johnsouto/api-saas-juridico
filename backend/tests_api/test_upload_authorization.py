from __future__ import annotations

import httpx


def test_upload_requires_auth(api_client: httpx.Client):
    r = api_client.post(
        "/api/v1/documents/upload",
        files={"file": ("hello.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 401


def test_upload_download_delete_roundtrip(auth_client: httpx.Client, write_enabled: None):
    r = auth_client.post(
        "/api/v1/documents/upload",
        files={"file": ("hello.txt", b"hello", "text/plain")},
    )
    r.raise_for_status()
    doc = r.json()
    doc_id = doc["id"]

    r2 = auth_client.get(f"/api/v1/documents/{doc_id}/download")
    r2.raise_for_status()
    payload = r2.json()
    assert payload.get("url")

    # Cleanup (best-effort).
    auth_client.delete(f"/api/v1/documents/{doc_id}")

