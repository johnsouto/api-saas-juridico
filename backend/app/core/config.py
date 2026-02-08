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

    def cors_origins_list(self) -> list[str]:
        try:
            data = json.loads(self.CORS_ORIGINS)
            if isinstance(data, list):
                return [str(x) for x in data]
        except Exception:
            pass
        return [self.CORS_ORIGINS]


settings = Settings()
