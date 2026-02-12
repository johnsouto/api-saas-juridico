from __future__ import annotations

import io

import pytest
from fastapi import HTTPException

from app.services.upload_security_service import UploadSecurityService


@pytest.mark.asyncio
async def test_upload_blocks_forbidden_extension():
    svc = UploadSecurityService()
    with pytest.raises(HTTPException) as exc:
        svc.validate_upload(filename="malware.exe", content_type="application/octet-stream", size_bytes=10)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_upload_blocks_oversize(monkeypatch):
    monkeypatch.setattr("app.services.upload_security_service.settings.UPLOAD_MAX_FILE_MB", 1)
    monkeypatch.setattr("app.services.upload_security_service.settings.ERROR_SCHEMA_ENFORCE_429_413", True)
    svc = UploadSecurityService()
    with pytest.raises(HTTPException) as exc:
        svc.validate_upload(filename="doc.pdf", content_type="application/pdf", size_bytes=2 * 1024 * 1024)
    assert exc.value.status_code == 413
    assert exc.value.detail == "Arquivo acima do limite permitido."


@pytest.mark.asyncio
async def test_upload_sanitizes_filename():
    svc = UploadSecurityService()
    safe_name = svc.validate_upload(filename="..\\foo/\nbar.pdf", content_type="application/pdf", size_bytes=1000)
    assert "/" not in safe_name
    assert "\\" not in safe_name
    assert "\n" not in safe_name


@pytest.mark.asyncio
async def test_upload_scanner_noop_keeps_stream_position():
    svc = UploadSecurityService()
    payload = io.BytesIO(b"abc")
    payload.seek(2)
    svc.scan_upload(fileobj=payload, filename="a.pdf", content_type="application/pdf")
    assert payload.tell() == 2
