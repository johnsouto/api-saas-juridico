from __future__ import annotations

import os
import random
import string
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from fastapi import Request
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user
from app.api.v1.endpoints import auth as auth_endpoint
from app.api.v1.endpoints import clients as clients_endpoint
from app.api.v1.endpoints import documents as documents_endpoint
from app.api.v1.endpoints import users as users_endpoint
from app.core.exceptions import AuthError
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.main import app
from app.models.client import Client
from app.models.document import Document
from app.models.enums import UserRole
from app.models.user import User


PRODUCTION_DOMAIN_SUBSTR = "elementojuris.cloud"


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() == "true"


def _is_local_base_url(base_url: str) -> bool:
    try:
        u = httpx.URL(base_url)
        return u.host in {"localhost", "127.0.0.1", "test"}
    except Exception:
        return False


def _rand_slug(prefix: str = "qa") -> str:
    suffix = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"{prefix}-{suffix}"


def _rand_email(prefix: str = "qa") -> str:
    suffix = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(10))
    return f"{prefix}+{suffix}@example.com"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(frozen=True)
class ApiTestConfig:
    base_url: str
    email: str
    password: str
    allow_write: bool
    seed_strategy: str
    platform_admin_key: str | None


def get_api_test_config() -> ApiTestConfig:
    requested_base_url = (os.getenv("API_BASE_URL") or "http://test").strip().rstrip("/")
    base_url = requested_base_url or "http://test"
    if PRODUCTION_DOMAIN_SUBSTR in base_url:
        pytest.exit(
            "\n".join(
                [
                    "Blocked: refusing to run API tests against a production domain.",
                    f"API_BASE_URL={base_url}",
                    "",
                    "Set API_BASE_URL to localhost/staging (e.g. http://localhost:8000).",
                ]
            ),
            returncode=2,
        )

    seed_strategy = (os.getenv("API_SEED_STRATEGY") or "none").strip().lower()
    if seed_strategy not in {"api", "db", "none"}:
        pytest.exit(f"Invalid API_SEED_STRATEGY={seed_strategy} (use api|db|none).", returncode=2)

    allow_write = _env_bool("API_ALLOW_WRITE", False)

    fallback_email = "admin@demo.example.com" if _is_local_base_url(base_url) else ""
    fallback_password = "admin12345" if _is_local_base_url(base_url) else ""
    email = (os.getenv("API_TEST_EMAIL") or fallback_email).strip().lower()
    password = (os.getenv("API_TEST_PASSWORD") or fallback_password).strip()

    if not email or not password:
        pytest.exit(
            "\n".join(
                [
                    "Missing API test credentials.",
                    "Set API_TEST_EMAIL and API_TEST_PASSWORD (required for staging/CI).",
                    "",
                    "Local dev convenience (only for localhost):",
                    "  API_TEST_EMAIL defaults to admin@demo.example.com",
                    "  API_TEST_PASSWORD defaults to admin12345",
                ]
            ),
            returncode=2,
        )

    platform_admin_key = os.getenv("API_PLATFORM_ADMIN_KEY")
    if platform_admin_key:
        platform_admin_key = platform_admin_key.strip()

    return ApiTestConfig(
        base_url=base_url,
        email=email,
        password=password,
        allow_write=allow_write,
        seed_strategy=seed_strategy,
        platform_admin_key=platform_admin_key or None,
    )


class _FakeScalars:
    def __init__(self, values: list[object]):
        self._values = values

    def all(self) -> list[object]:
        return list(self._values)


class _FakeRow:
    def __init__(self, mapping: dict[str, int]):
        self._mapping = mapping


class _FakeResult:
    def __init__(
        self,
        *,
        scalar_value: object | None = None,
        scalar_values: list[object] | None = None,
        row_mapping: dict[str, int] | None = None,
    ) -> None:
        self._scalar_value = scalar_value
        self._scalar_values = scalar_values or []
        self._row_mapping = row_mapping

    def scalar_one_or_none(self) -> object | None:
        return self._scalar_value

    def scalars(self) -> _FakeScalars:
        return _FakeScalars(self._scalar_values)

    def first(self) -> object | None:
        return self._scalar_value

    def one(self) -> _FakeRow:
        if self._row_mapping is None:
            raise AssertionError("Row mapping not set for this fake result")
        return _FakeRow(self._row_mapping)


class _ApiState:
    def __init__(self) -> None:
        self.users: dict[uuid.UUID, User] = {}
        self.clients: dict[uuid.UUID, Client] = {}
        self.documents: dict[uuid.UUID, Document] = {}
        self.tokens: dict[str, uuid.UUID] = {}
        self.object_store: dict[str, bytes] = {}
        self.kanban_summary: dict[uuid.UUID, dict[str, int]] = {}

    def add_user(self, user: User) -> None:
        if not getattr(user, "id", None):
            user.id = uuid.uuid4()
        if not getattr(user, "criado_em", None):
            user.criado_em = _utcnow()
        if not getattr(user, "atualizado_em", None):
            user.atualizado_em = _utcnow()
        if getattr(user, "is_active", None) is None:
            user.is_active = True
        self.users[user.id] = user
        self.kanban_summary.setdefault(user.tenant_id, {"due_today": 0, "pendente": 0, "em_andamento": 0, "concluido": 0})

    def add_client(self, client: Client) -> None:
        if not getattr(client, "id", None):
            client.id = uuid.uuid4()
        if not getattr(client, "criado_em", None):
            client.criado_em = _utcnow()
        if not getattr(client, "atualizado_em", None):
            client.atualizado_em = _utcnow()
        if getattr(client, "is_active", None) is None:
            client.is_active = True
        self.clients[client.id] = client

    def add_document(self, document: Document) -> None:
        if not getattr(document, "id", None):
            document.id = uuid.uuid4()
        if not getattr(document, "criado_em", None):
            document.criado_em = _utcnow()
        if not getattr(document, "atualizado_em", None):
            document.atualizado_em = _utcnow()
        self.documents[document.id] = document

    def get_user_by_email(self, email: str) -> User | None:
        normalized = email.strip().lower()
        for user in self.users.values():
            if user.email.lower() == normalized:
                return user
        return None

    def issue_access_token(self, user: User) -> str:
        token = f"access-{uuid.uuid4()}"
        self.tokens[token] = user.id
        return token

    def resolve_user_from_token(self, token: str) -> User | None:
        user_id = self.tokens.get(token)
        if not user_id:
            return None
        return self.users.get(user_id)


class _FakeSession:
    def __init__(self, state: _ApiState) -> None:
        self.state = state
        self.sync_session = type("SyncSession", (), {"info": {}})()

    async def execute(self, stmt):  # noqa: ANN001
        compiled = stmt.compile()
        sql = str(compiled).lower()
        params = compiled.params

        if "from users" in sql:
            tenant_id = params.get("tenant_id_1")
            user_id = params.get("id_1")
            if user_id is not None:
                user = self.state.users.get(user_id)
                if user and (tenant_id is None or user.tenant_id == tenant_id):
                    return _FakeResult(scalar_value=user, scalar_values=[user])
                return _FakeResult(scalar_value=None, scalar_values=[])

            users = [u for u in self.state.users.values() if tenant_id is None or u.tenant_id == tenant_id]
            if "users.is_active" in sql:
                users = [u for u in users if u.is_active]
            users.sort(key=lambda item: item.criado_em, reverse=True)
            return _FakeResult(scalar_values=users)

        if "from clients" in sql:
            tenant_id = params.get("tenant_id_1")
            client_id = params.get("id_1")
            documento = params.get("documento_1")
            clients = [c for c in self.state.clients.values() if tenant_id is None or c.tenant_id == tenant_id]

            if documento is not None:
                client = next((c for c in clients if c.documento == documento), None)
                return _FakeResult(scalar_value=client, scalar_values=[client] if client else [])

            if client_id is not None:
                client = next((c for c in clients if c.id == client_id), None)
                if client and ("clients.is_active is true" not in sql or client.is_active):
                    return _FakeResult(scalar_value=client, scalar_values=[client])
                return _FakeResult(scalar_value=None, scalar_values=[])

            if "clients.is_active is true" in sql:
                clients = [c for c in clients if c.is_active]
            clients.sort(key=lambda item: item.criado_em, reverse=True)
            return _FakeResult(scalar_values=clients)

        if "from documents" in sql:
            tenant_id = params.get("tenant_id_1")
            document_id = params.get("id_1")
            document = self.state.documents.get(document_id)
            if document and document.tenant_id == tenant_id:
                return _FakeResult(scalar_value=document, scalar_values=[document])
            return _FakeResult(scalar_value=None, scalar_values=[])

        if "from tarefas" in sql:
            tenant_id = params.get("tenant_id_1")
            summary = self.state.kanban_summary.get(
                tenant_id,
                {"due_today": 0, "pendente": 0, "em_andamento": 0, "concluido": 0},
            )
            return _FakeResult(row_mapping=summary)

        raise AssertionError(f"Unsupported SQL in tests_api fake session: {sql}")

    def add(self, obj: object) -> None:
        if isinstance(obj, User):
            self.state.add_user(obj)
            return
        if isinstance(obj, Client):
            self.state.add_client(obj)
            return
        if isinstance(obj, Document):
            self.state.add_document(obj)
            return
        raise AssertionError(f"Unsupported object type for add(): {type(obj)!r}")

    async def commit(self) -> None:
        return None

    async def rollback(self) -> None:
        return None

    async def refresh(self, obj: object) -> None:
        return None

    async def delete(self, obj: object) -> None:
        if isinstance(obj, Document):
            self.state.documents.pop(obj.id, None)
            return
        raise AssertionError(f"Unsupported object type for delete(): {type(obj)!r}")


@pytest.fixture(scope="session")
def api_config() -> ApiTestConfig:
    return get_api_test_config()


@pytest.fixture()
def api_state(monkeypatch: pytest.MonkeyPatch) -> _ApiState:
    state = _ApiState()
    tenant_id = uuid.uuid4()
    admin = User(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        nome="Admin Demo",
        first_name="Admin",
        last_name=None,
        oab_number=None,
        email="admin@demo.example.com",
        senha_hash=hash_password("admin12345"),
        role=UserRole.admin,
        is_active=True,
        criado_em=_utcnow(),
        atualizado_em=_utcnow(),
        last_activity_at=None,
    )
    state.add_user(admin)
    state.kanban_summary[tenant_id] = {"due_today": 1, "pendente": 2, "em_andamento": 1, "concluido": 3}

    async def fake_authenticate(self, db, email: str, password: str):  # noqa: ANN001
        user = state.get_user_by_email(email)
        if not user or not verify_password(password, user.senha_hash):
            raise AuthError("Credenciais inválidas.")
        access = state.issue_access_token(user)
        refresh = f"refresh-{uuid.uuid4()}"
        return user, access, refresh

    async def fake_get_current_user(request: Request) -> User:
        auth_header = request.headers.get("authorization", "")
        token = ""
        if auth_header.lower().startswith("bearer "):
            token = auth_header.split(" ", 1)[1].strip()
        if not token:
            token = request.cookies.get("saas_access", "").strip()
        if not token:
            raise AuthError("Token ausente")
        user = state.resolve_user_from_token(token)
        if not user or not user.is_active:
            raise AuthError("Token inválido")
        return user

    async def fake_get_db() -> AsyncIterator[_FakeSession]:
        yield _FakeSession(state)

    async def _noop_limit(*args, **kwargs):  # noqa: ANN002, ANN003
        return None

    def fake_build_tenant_key(self, *, tenant_id: str, filename: str) -> str:  # noqa: ANN001
        return f"{tenant_id}/{filename}"

    def fake_upload_fileobj(self, *, key: str, fileobj, content_type: str | None = None) -> None:  # noqa: ANN001
        state.object_store[key] = fileobj.read()
        fileobj.seek(0)

    def fake_generate_presigned_get_url(self, *, key: str, expires_in: int = 3600) -> str:  # noqa: ANN001
        return f"http://test-storage.local/{key}?expires_in={expires_in}"

    def fake_delete_object(self, *, key: str) -> None:  # noqa: ANN001
        state.object_store.pop(key, None)

    monkeypatch.setattr(type(auth_endpoint._auth_service), "authenticate", fake_authenticate)
    monkeypatch.setattr(auth_endpoint.settings, "AUTH_RL_ENABLED", False)
    monkeypatch.setattr(auth_endpoint.settings, "AUTH_LOCKOUT_ENABLED", False)

    monkeypatch.setattr(type(users_endpoint._limits), "enforce_user_limit", _noop_limit)
    monkeypatch.setattr(type(clients_endpoint._limits), "enforce_client_limit", _noop_limit)
    monkeypatch.setattr(type(documents_endpoint._limits), "enforce_storage_limit", _noop_limit)
    monkeypatch.setattr(type(documents_endpoint._s3), "build_tenant_key", fake_build_tenant_key)
    monkeypatch.setattr(type(documents_endpoint._s3), "upload_fileobj", fake_upload_fileobj)
    monkeypatch.setattr(type(documents_endpoint._s3), "generate_presigned_get_url", fake_generate_presigned_get_url)
    monkeypatch.setattr(type(documents_endpoint._s3), "delete_object", fake_delete_object)

    app.dependency_overrides[get_db] = fake_get_db
    app.dependency_overrides[get_current_user] = fake_get_current_user
    try:
        yield state
    finally:
        app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def api_client(api_config: ApiTestConfig, api_state: _ApiState) -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url=api_config.base_url,
        timeout=20.0,
        follow_redirects=True,
    ) as client:
        yield client


async def _login_cookie_session(*, client: AsyncClient, email: str, password: str) -> None:
    r = await client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    r.raise_for_status()
    assert r.json().get("ok") is True


@pytest_asyncio.fixture()
async def auth_client(api_client: AsyncClient, api_config: ApiTestConfig) -> AsyncClient:
    await _login_cookie_session(client=api_client, email=api_config.email, password=api_config.password)
    return api_client


@pytest.fixture()
def write_enabled(api_config: ApiTestConfig) -> None:
    if not api_config.allow_write:
        pytest.skip("Write tests disabled. Set API_ALLOW_WRITE=true to enable.")


@pytest.fixture()
def platform_admin_key(api_config: ApiTestConfig, write_enabled: None) -> str:
    if api_config.seed_strategy != "api":
        pytest.skip("Seed strategy is not api. Set API_SEED_STRATEGY=api to enable platform-provisioned fixtures.")
    if not api_config.platform_admin_key:
        pytest.skip("Missing API_PLATFORM_ADMIN_KEY (required for API_SEED_STRATEGY=api).")
    return api_config.platform_admin_key


@pytest_asyncio.fixture()
async def provisioned_tenant(
    api_state: _ApiState,
    platform_admin_key: str,  # noqa: ARG001
) -> AsyncIterator[dict]:
    slug = _rand_slug("qa-tenant")
    admin_email = _rand_email("qa-admin")
    admin_password = "Admin12!a"
    tenant_id = uuid.uuid4()

    admin_user = User(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        nome="QA Admin",
        first_name="QA",
        last_name="Admin",
        oab_number=None,
        email=admin_email,
        senha_hash=hash_password(admin_password),
        role=UserRole.admin,
        is_active=True,
        criado_em=_utcnow(),
        atualizado_em=_utcnow(),
        last_activity_at=None,
    )
    api_state.add_user(admin_user)
    access_token = api_state.issue_access_token(admin_user)

    payload = {
        "tenant": {"id": str(tenant_id), "slug": slug},
        "admin": {"id": str(admin_user.id), "email": admin_email},
        "tokens": {"access_token": access_token},
    }
    try:
        yield payload
    finally:
        api_state.users.pop(admin_user.id, None)
