from __future__ import annotations

import io
from datetime import timedelta
from uuid import uuid4

from miniopy_async import Minio

from app.core.config import get_settings

settings = get_settings()

_client: Minio | None = None


def get_minio_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            endpoint=settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_use_ssl,
        )
    return _client


async def ensure_bucket() -> None:
    """Create the evidence bucket if it doesn't exist (called on startup)."""
    client = get_minio_client()
    exists = await client.bucket_exists(settings.minio_bucket)
    if not exists:
        await client.make_bucket(settings.minio_bucket)


async def upload_blob(
    data: bytes,
    *,
    filename: str | None = None,
    content_type: str = 'application/octet-stream',
    folder: str = 'uploads',
) -> str:
    """Upload raw bytes to MinIO and return the object key."""
    client = get_minio_client()
    ext = ''
    if filename:
        parts = filename.rsplit('.', 1)
        ext = f'.{parts[1]}' if len(parts) > 1 else ''
    object_key = f'{folder}/{uuid4().hex}{ext}'

    await client.put_object(
        bucket_name=settings.minio_bucket,
        object_name=object_key,
        data=io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    return object_key


def public_url(object_key: str) -> str:
    """Return the public URL for a stored object (bucket must be public-read)."""
    base = settings.minio_public_url.rstrip('/')
    bucket = settings.minio_bucket
    return f'{base}/{bucket}/{object_key}'


async def presigned_url(object_key: str, expires: timedelta = timedelta(hours=1)) -> str:
    """Generate a pre-signed GET URL (for private buckets)."""
    client = get_minio_client()
    return await client.presigned_get_object(
        bucket_name=settings.minio_bucket,
        object_name=object_key,
        expires=expires,
    )
