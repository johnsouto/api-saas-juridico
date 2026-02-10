from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import EmailStr

from app.models.enums import UserRole
from app.schemas.common import APIModel


class UserOut(APIModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    nome: str
    first_name: str | None = None
    last_name: str | None = None
    # Output should not 500 if legacy/seed data uses a non-deliverable domain (e.g. *.local).
    email: str
    role: UserRole
    is_active: bool
    criado_em: datetime


class UserCreate(APIModel):
    nome: str
    email: EmailStr
    senha: str
    role: UserRole
