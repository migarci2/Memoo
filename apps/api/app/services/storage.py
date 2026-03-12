from __future__ import annotations

import asyncio
import io
from datetime import timedelta
from uuid import uuid4

from google.cloud import storage as gcs_storage
from miniopy_async import Minio

from app.core.config import get_settings

settings = get_settings()

_client: Minio | None = None
_gcs_client: gcs_storage.Client | None = None


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


def get_gcs_client() -> gcs_storage.Client:
    global _gcs_client
    if _gcs_client is None:
        if settings.gcs_project_id:
            _gcs_client = gcs_storage.Client(project=settings.gcs_project_id)
        else:
            _gcs_client = gcs_storage.Client()
    return _gcs_client


async def ensure_bucket() -> None:
    """Ensure the backing bucket exists when the selected backend supports it."""
    if settings.storage_backend == 'gcs':
        # In GCP the bucket is managed by Terraform, so startup should not require
        # Storage Admin permissions on the runtime service account.
        return

    client = get_minio_client()
    exists = await client.bucket_exists(settings.storage_bucket)
    if not exists:
        await client.make_bucket(settings.storage_bucket)


def _gcs_public_url(object_key: str) -> str:
    base = settings.storage_public_url.strip()
    if base:
        return f'{base.rstrip("/")}/{object_key}'
    return f'https://storage.googleapis.com/{settings.storage_bucket}/{object_key}'


def _gcs_upload_blob(
    data: bytes,
    *,
    object_key: str,
    content_type: str,
) -> None:
    bucket = get_gcs_client().bucket(settings.storage_bucket)
    blob = bucket.blob(object_key)
    blob.upload_from_file(io.BytesIO(data), size=len(data), content_type=content_type)


def _gcs_presigned_url(object_key: str, expires: timedelta) -> str:
    bucket = get_gcs_client().bucket(settings.storage_bucket)
    blob = bucket.blob(object_key)
    return blob.generate_signed_url(version='v4', expiration=expires, method='GET')


async def upload_blob(
    data: bytes,
    *,
    filename: str | None = None,
    content_type: str = 'application/octet-stream',
    folder: str = 'uploads',
) -> str:
    """Upload raw bytes to the configured blob store and return the object key."""
    ext = ''
    if filename:
        parts = filename.rsplit('.', 1)
        ext = f'.{parts[1]}' if len(parts) > 1 else ''
    object_key = f'{folder}/{uuid4().hex}{ext}'

    if settings.storage_backend == 'gcs':
        await asyncio.to_thread(
            _gcs_upload_blob,
            data,
            object_key=object_key,
            content_type=content_type,
        )
        return object_key

    client = get_minio_client()
    await client.put_object(
        bucket_name=settings.storage_bucket,
        object_name=object_key,
        data=io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )
    return object_key


def public_url(object_key: str) -> str:
    """Return the public URL for a stored object."""
    if settings.storage_backend == 'gcs':
        return _gcs_public_url(object_key)

    base = settings.storage_public_url.rstrip('/')
    return f'{base}/{settings.storage_bucket}/{object_key}'


async def presigned_url(object_key: str, expires: timedelta = timedelta(hours=1)) -> str:
    """Generate a pre-signed GET URL for the configured backend."""
    if settings.storage_backend == 'gcs':
        return await asyncio.to_thread(_gcs_presigned_url, object_key, expires)

    client = get_minio_client()
    return await client.presigned_get_object(
        bucket_name=settings.storage_bucket,
        object_name=object_key,
        expires=expires,
    )
