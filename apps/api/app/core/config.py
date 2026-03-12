from functools import lru_cache
from typing import Literal
from urllib.parse import quote_plus

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_env: str = 'development'
    app_debug: bool = True
    api_host: str = '0.0.0.0'
    api_port: int = 8000

    database_url: str | None = Field(default=None, validation_alias='DATABASE_URL')
    db_host: str = Field(default='localhost', validation_alias='DB_HOST')
    db_port: int = Field(default=5432, validation_alias='DB_PORT')
    db_name: str = Field(default='memoo', validation_alias='DB_NAME')
    db_user: str = Field(default='memoo', validation_alias='DB_USER')
    db_password: str = Field(default='memoo', validation_alias='DB_PASSWORD')
    db_cloudsql_instance: str = Field(default='', validation_alias='DB_CLOUDSQL_INSTANCE')
    cors_origins: str = 'http://localhost:3000'

    # Blob storage
    storage_backend: Literal['minio', 'gcs'] = Field(
        default='minio',
        validation_alias=AliasChoices('STORAGE_BACKEND', 'MINIO_BACKEND'),
    )
    storage_bucket: str = Field(
        default='memoo-evidence',
        validation_alias=AliasChoices('STORAGE_BUCKET', 'MINIO_BUCKET'),
    )
    storage_public_url: str = Field(
        default='http://localhost:9000',
        validation_alias=AliasChoices('STORAGE_PUBLIC_URL', 'MINIO_PUBLIC_URL'),
    )

    # MinIO / S3-compatible blob storage
    minio_endpoint: str = Field(default='localhost:9000', validation_alias='MINIO_ENDPOINT')
    minio_access_key: str = Field(default='memoo', validation_alias='MINIO_ACCESS_KEY')
    minio_secret_key: str = Field(default='memoosecret', validation_alias='MINIO_SECRET_KEY')
    minio_use_ssl: bool = Field(default=False, validation_alias='MINIO_USE_SSL')

    # Google Cloud Storage
    gcs_project_id: str = Field(default='', validation_alias='GCS_PROJECT_ID')

    # Gemini
    google_api_key: str = ''
    gemini_model: str = 'gemini-2.5-flash'

    # Sandbox (remote browser)
    sandbox_cdp_url: str = 'http://sandbox:9223'

    @model_validator(mode='after')
    def populate_database_url(self) -> 'Settings':
        if self.database_url:
            return self

        quoted_user = quote_plus(self.db_user)
        quoted_password = quote_plus(self.db_password)
        quoted_name = quote_plus(self.db_name)

        if self.db_cloudsql_instance:
            socket_path = quote_plus(f'/cloudsql/{self.db_cloudsql_instance}')
            self.database_url = (
                f'postgresql+asyncpg://{quoted_user}:{quoted_password}@/{quoted_name}'
                f'?host={socket_path}'
            )
            return self

        self.database_url = (
            f'postgresql+asyncpg://{quoted_user}:{quoted_password}@{self.db_host}:{self.db_port}/'
            f'{quoted_name}'
        )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
