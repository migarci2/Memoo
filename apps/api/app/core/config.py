from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_env: str = 'development'
    app_debug: bool = True
    api_host: str = '0.0.0.0'
    api_port: int = 8000

    database_url: str = 'sqlite+aiosqlite:///./memoo.db'
    cors_origins: str = 'http://localhost:3000'

    google_api_key: str | None = None
    gemini_live_model: str = 'gemini-2.0-flash-live-001'


@lru_cache
def get_settings() -> Settings:
    return Settings()
