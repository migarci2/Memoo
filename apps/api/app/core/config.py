from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_env: str = 'development'
    app_debug: bool = True
    api_host: str = '0.0.0.0'
    api_port: int = 8000

    database_url: str = 'postgresql+asyncpg://memoo:memoo@localhost:5432/memoo'
    cors_origins: str = 'http://localhost:3000'

    google_api_key: str | None = None
    gemini_live_model: str = 'gemini-2.0-flash-live-001'

    # MinIO / S3-compatible blob storage
    minio_endpoint: str = 'localhost:9000'
    minio_access_key: str = 'memoo'
    minio_secret_key: str = 'memoosecret'
    minio_bucket: str = 'memoo-evidence'
    minio_use_ssl: bool = False
    minio_public_url: str = 'http://localhost:9000'


@lru_cache
def get_settings() -> Settings:
    return Settings()
