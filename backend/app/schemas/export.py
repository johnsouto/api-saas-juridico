from __future__ import annotations

import uuid
from datetime import datetime

from app.schemas.common import APIModel


class TenantExportRequestOut(APIModel):
    export_id: uuid.UUID
    status: str
    expires_at: datetime
    message: str | None = None
    latest_export_id: uuid.UUID | None = None
    retry_after_seconds: int | None = None


class TenantExportStatusOut(APIModel):
    export_id: uuid.UUID
    status: str
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    expires_at: datetime
    file_size_bytes: int | None = None
    error_message: str | None = None
    downloaded_at: datetime | None = None
    email_sent_at: datetime | None = None
    note: str | None = None


class TenantExportDownloadOut(APIModel):
    url: str
    expires_in: int
