from __future__ import annotations

import os
import random
import string
from dataclasses import dataclass
from typing import Iterator

import httpx
import pytest


PRODUCTION_DOMAIN_SUBSTR = "elementojuris.cloud"


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() == "true"


def _is_local_base_url(base_url: str) -> bool:
    try:
        u = httpx.URL(base_url)
        return u.host in {"localhost", "127.0.0.1"}
    except Exception:
        return False


def _generate_valid_cnpj() -> str:
    """
    Generate a random valid CNPJ (digits only).
    """
    # 12 random digits (avoid all-equal)
    base = [random.randint(0, 9) for _ in range(12)]
    if len(set(base)) == 1:
        base[0] = (base[0] + 1) % 10

    def calc_digit(nums: list[int], weights: list[int]) -> int:
        total = sum(n * w for n, w in zip(nums, weights, strict=True))
        r = total % 11
        return 0 if r < 2 else 11 - r

    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    d1 = calc_digit(base, w1)
    w2 = [6] + w1
    d2 = calc_digit(base + [d1], w2)
    return "".join(str(d) for d in (base + [d1, d2]))


def _rand_slug(prefix: str = "qa") -> str:
    suffix = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"{prefix}-{suffix}"


def _rand_email(prefix: str = "qa") -> str:
    suffix = "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(10))
    return f"{prefix}+{suffix}@example.com"


@dataclass(frozen=True)
class ApiTestConfig:
    base_url: str
    email: str
    password: str
    allow_write: bool
    seed_strategy: str
    platform_admin_key: str | None


def get_api_test_config() -> ApiTestConfig:
    base_url = (os.getenv("API_BASE_URL") or "http://localhost:8000").strip().rstrip("/")
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


@pytest.fixture(scope="session")
def api_config() -> ApiTestConfig:
    return get_api_test_config()


@pytest.fixture()
def api_client(api_config: ApiTestConfig) -> Iterator[httpx.Client]:
    with httpx.Client(base_url=api_config.base_url, timeout=20.0, follow_redirects=True) as client:
        yield client


def _login_cookie_session(*, client: httpx.Client, email: str, password: str) -> None:
    r = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": password},
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    r.raise_for_status()
    assert r.json().get("ok") is True


@pytest.fixture()
def auth_client(api_client: httpx.Client, api_config: ApiTestConfig) -> httpx.Client:
    _login_cookie_session(client=api_client, email=api_config.email, password=api_config.password)
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


@pytest.fixture()
def provisioned_tenant(platform_admin_key: str, api_client: httpx.Client) -> Iterator[dict]:
    """
    Provision a tenant via /platform (returns access token for API calls),
    and tear it down afterwards (deactivate + delete).

    Requires:
    - API_ALLOW_WRITE=true
    - API_SEED_STRATEGY=api
    - API_PLATFORM_ADMIN_KEY set
    """
    slug = _rand_slug("qa-tenant")
    admin_email = _rand_email("qa-admin")
    admin_password = "Admin12!a"
    payload = {
        "tenant_nome": f"QA Tenant {slug}",
        "tenant_tipo_documento": "cnpj",
        "tenant_documento": _generate_valid_cnpj(),
        "tenant_slug": slug,
        "admin_nome": "QA Admin",
        "admin_email": admin_email,
        "admin_senha": admin_password,
    }

    r = api_client.post(
        "/api/v1/platform/tenants",
        json=payload,
        headers={"x-platform-admin-key": platform_admin_key},
    )
    r.raise_for_status()
    created = r.json()
    tenant_id = created["tenant"]["id"]

    try:
        yield created
    finally:
        # Best-effort teardown; never fail the suite because cleanup couldn't run.
        try:
            api_client.post(
                f"/api/v1/platform/tenants/{tenant_id}/deactivate",
                headers={"x-platform-admin-key": platform_admin_key},
            )
        except Exception:
            pass
        try:
            api_client.delete(
                f"/api/v1/platform/tenants/{tenant_id}",
                params={"confirm": slug},
                headers={"x-platform-admin-key": platform_admin_key},
            )
        except Exception:
            pass

