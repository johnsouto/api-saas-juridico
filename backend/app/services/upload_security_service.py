from __future__ import annotations

import re
from pathlib import Path
from typing import BinaryIO, Protocol

from fastapi import HTTPException, status

from app.core.config import settings


class FileScanner(Protocol):
    def scan_file(self, *, fileobj: BinaryIO, filename: str, content_type: str | None) -> None: ...


class NoOpFileScanner:
    def scan_file(self, *, fileobj: BinaryIO, filename: str, content_type: str | None) -> None:
        # Placeholder for future AV integration (ClamAV/service).
        return


def _safe_filename(filename: str) -> str:
    name = filename.replace("\\", "_").replace("/", "_").strip()
    name = re.sub(r"[\r\n\t]+", " ", name)
    name = re.sub(r"\s+", " ", name)
    # Keep visible filename safe and bounded.
    return name[:255] or "arquivo"


class UploadSecurityService:
    def __init__(self) -> None:
        self._scanner: FileScanner = NoOpFileScanner()

    def _extension(self, filename: str) -> str:
        return Path(filename).suffix.lower().lstrip(".")

    def validate_upload(self, *, filename: str, content_type: str | None, size_bytes: int) -> str:
        safe_name = _safe_filename(filename)
        ext = self._extension(safe_name)

        blocked_ext = settings.csv_set(settings.UPLOAD_BLOCKED_EXTENSIONS)
        allowed_ext = settings.csv_set(settings.UPLOAD_ALLOWED_EXTENSIONS)
        allowed_mime = settings.csv_set(settings.UPLOAD_ALLOWED_MIME_TYPES)

        if ext and ext in blocked_ext:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de arquivo não permitido.")

        if allowed_ext and ext and ext not in allowed_ext:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de arquivo não permitido.")

        ctype = (content_type or "").strip().lower()
        if allowed_mime and ctype and ctype not in allowed_mime:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de arquivo não permitido.")

        max_mb = max(int(settings.UPLOAD_MAX_FILE_MB), 1)
        max_bytes = max_mb * 1024 * 1024
        if int(size_bytes) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Arquivo excede o limite permitido de {max_mb} MB.",
            )

        return safe_name

    def scan_upload(self, *, fileobj: BinaryIO, filename: str, content_type: str | None) -> None:
        if not settings.UPLOAD_SCANNER_ENABLED:
            return
        pos = fileobj.tell()
        try:
            self._scanner.scan_file(fileobj=fileobj, filename=filename, content_type=content_type)
        finally:
            fileobj.seek(pos)

