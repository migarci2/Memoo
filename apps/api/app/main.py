from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine
from app.models import entities  # noqa: F401
from app.services.automation_engine import start_scheduler, stop_scheduler
from app.services.storage import ensure_bucket

settings = get_settings()

app = FastAPI(title='Memoo API', version='0.1.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(',') if origin.strip()],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.on_event('startup')
async def on_startup() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Ensure new columns exist on existing tables (no-op if already present)
        await conn.execute(
            __import__('sqlalchemy').text(
                "ALTER TABLE runs ADD COLUMN IF NOT EXISTS use_sandbox BOOLEAN DEFAULT false"
            )
        )
        await conn.execute(
            __import__('sqlalchemy').text(
                "ALTER TABLE playbooks ADD COLUMN IF NOT EXISTS folder_id VARCHAR(36)"
            )
        )
        await conn.execute(
            __import__('sqlalchemy').text(
                "ALTER TABLE runs ADD COLUMN IF NOT EXISTS selected_vault_credential_ids JSON DEFAULT '[]'::json"
            )
        )
        await conn.execute(
            __import__('sqlalchemy').text(
                "ALTER TABLE playbook_automations ADD COLUMN IF NOT EXISTS selected_vault_credential_ids JSON DEFAULT '[]'::json"
            )
        )
        await conn.execute(
            __import__('sqlalchemy').text(
                "ALTER TABLE vault_credentials ADD COLUMN IF NOT EXISTS encrypted_value VARCHAR(500)"
            )
        )
    await ensure_bucket()
    start_scheduler()


@app.on_event('shutdown')
async def on_shutdown() -> None:
    await stop_scheduler()


app.include_router(router, prefix='/api')
