from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.api.deps import require_roles
from app.api.v1.endpoints.clients import get_client
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.enums import UserRole


class _FakeResult:
    def __init__(self, value=None):
        self._value = value

    def scalar_one_or_none(self):
        return self._value


class _FakeSession:
    async def execute(self, stmt):
        sql = str(stmt)
        assert "clients.tenant_id" in sql
        return _FakeResult(None)


@pytest.mark.asyncio
async def test_require_roles_blocks_non_admin():
    guard = require_roles(UserRole.admin)
    user = SimpleNamespace(role=UserRole.advogado)
    with pytest.raises(ForbiddenError):
        await guard(user=user)


@pytest.mark.asyncio
async def test_client_get_is_tenant_scoped():
    db = _FakeSession()
    user = SimpleNamespace(tenant_id=uuid.uuid4())
    with pytest.raises(NotFoundError):
        await get_client(client_id=uuid.uuid4(), db=db, user=user)

