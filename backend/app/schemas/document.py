from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.common import APIModel


class DocumentOut(APIModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    process_id: uuid.UUID | None
    client_id: uuid.UUID | None
    honorario_id: uuid.UUID | None
    categoria: str | None
    mime_type: str | None
    s3_key: str
    filename: str
    size_bytes: int
    criado_em: datetime


class PresignedUrlOut(APIModel):
    url: str
    expires_in: int = Field(default=3600, ge=60, le=86400)
