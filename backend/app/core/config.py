from __future__ import annotations

import json
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    ENV: str = "dev"

    DATABASE_URL: str

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    # Kept short on purpose. Access tokens are refreshed using the HttpOnly refresh cookie.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 20
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Session policy (idle timeout for refresh tokens).
    # If the user is inactive for longer than this, refresh will be denied and they must login again.
    FREE_IDLE_TIMEOUT_HOURS: int = 12
    PLUS_IDLE_TIMEOUT_DAYS: int = 30

    # Auth abuse protection (login/register).
    AUTH_RL_ENABLED: bool = True
    AUTH_RL_WINDOW_SEC: int = 60
    AUTH_RL_MAX: int = 10

    AUTH_LOCKOUT_ENABLED: bool = True
    AUTH_LOCKOUT_MAX_ATTEMPTS: int = 5
    AUTH_LOCKOUT_MINUTES: int = 10

    # Salt used to hash PII in logs (email/ip). Use a strong value in production.
    LOG_PII_HASH_SALT: str = "dev-log-salt-change-me"

    # Optional response-message normalization for specific status codes.
    # Keep OFF by default to avoid contract surprises for existing clients.
    ERROR_SCHEMA_ENFORCE_429_413: bool = False

    # CORS_ORIGINS can be a JSON array string: ["http://localhost","https://localhost"]
    CORS_ORIGINS: str = '["http://localhost","https://localhost"]'

    # S3 / MinIO
    S3_ENDPOINT_URL: str
    # Used only for presigned URLs (host must match what the browser can reach).
    # If empty, falls back to S3_ENDPOINT_URL.
    S3_PUBLIC_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_BUCKET_NAME: str
    S3_REGION: str = "us-east-1"
    S3_USE_SSL: bool = False
    S3_VERIFY_SSL: bool = False

    # SMTP (optional)
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAIL_FROM: str = "noreply@local"
    EMAIL_FROM_NAME: str = "SaaS Juridico"

    SEED_ON_STARTUP: bool = True

    # Public URL of the web app (used to build email links).
    # Example (prod): https://elementojuris.cloud
    PUBLIC_APP_URL: str = "http://localhost"

    # Platform-level super-admin key (for provisioning tenants).
    # If empty/None, platform endpoints will be disabled.
    PLATFORM_ADMIN_KEY: str | None = None

    # Billing
    BILLING_PROVIDER: str = "FAKE"  # FAKE | STRIPE | MERCADOPAGO
    BILLING_WEBHOOK_SECRET: str | None = None

    # Cloudflare Turnstile (anti-bot)
    # If TURNSTILE_SECRET_KEY is empty/None, verification is disabled.
    TURNSTILE_SECRET_KEY: str | None = None

    # Telegram alerts (optional)
    TELEGRAM_BOT_TOKEN: str | None = None
    TELEGRAM_CHAT_ID: str | None = None

    # Upload hardening
    UPLOAD_MAX_FILE_MB: int = 25
    UPLOAD_ALLOWED_EXTENSIONS: str = "pdf,doc,docx,jpg,jpeg,png,webp,xlsx,xls,txt"
    UPLOAD_BLOCKED_EXTENSIONS: str = "exe,js,bat,cmd,sh,dll,msi,com,scr,jar,ps1,vbs"
    UPLOAD_ALLOWED_MIME_TYPES: str = (
        "application/pdf,"
        "application/msword,"
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document,"
        "application/vnd.ms-excel,"
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,"
        "image/jpeg,image/png,image/webp,text/plain"
    )
    UPLOAD_SCANNER_ENABLED: bool = False

    # Audit logging hardening
    AUDIT_MINIMAL_MODE: bool = True
    AUDIT_TRACKED_TABLES: str = "clients,processes,documents,honorarios,agenda_eventos,tarefas"

    def cors_origins_list(self) -> list[str]:
        try:
            data = json.loads(self.CORS_ORIGINS)
            if isinstance(data, list):
                return [str(x) for x in data]
        except Exception:
            pass
        return [self.CORS_ORIGINS]

    def csv_set(self, value: str) -> set[str]:
        return {part.strip().lower() for part in value.split(",") if part.strip()}


settings = Settings()
