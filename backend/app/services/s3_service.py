from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import BinaryIO
from typing import Any

import boto3

from app.core.config import settings


@dataclass(frozen=True)
class S3Service:
    def _client(self, *, endpoint_url: str):
        return boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            use_ssl=settings.S3_USE_SSL,
            verify=settings.S3_VERIFY_SSL,
        )

    def build_tenant_key(self, *, tenant_id: str, filename: str) -> str:
        safe_name = filename.replace("\\", "_").replace("/", "_")
        return f"{tenant_id}/{uuid.uuid4()}-{safe_name}"

    def upload_fileobj(self, *, key: str, fileobj: BinaryIO, content_type: str | None = None) -> None:
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type
        self._client(endpoint_url=settings.S3_ENDPOINT_URL).upload_fileobj(
            fileobj, settings.S3_BUCKET_NAME, key, ExtraArgs=extra_args or None
        )

    def generate_presigned_get_url(self, *, key: str, expires_in: int = 3600) -> str:
        public_endpoint = settings.S3_PUBLIC_ENDPOINT_URL or settings.S3_ENDPOINT_URL
        return self._client(endpoint_url=public_endpoint).generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": settings.S3_BUCKET_NAME, "Key": key},
            ExpiresIn=expires_in,
        )

    def get_object(self, *, key: str) -> dict[str, Any]:
        return self._client(endpoint_url=settings.S3_ENDPOINT_URL).get_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=key,
        )

    def delete_object(self, *, key: str) -> None:
        self._client(endpoint_url=settings.S3_ENDPOINT_URL).delete_object(Bucket=settings.S3_BUCKET_NAME, Key=key)
