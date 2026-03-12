FROM python:3.11-slim

WORKDIR /app

# System deps for asyncpg (C extensions) and Playwright (Chromium)
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy only the dependency manifest to leverage layer caching.
# The actual source code is volume-mounted at runtime so changes
# are reflected without rebuilding the image.
COPY pyproject.toml README.md ./

# Install all Python dependencies (not the package itself — avoids
# egg-info conflicts with the mounted source volume).
RUN pip install --no-cache-dir \
    "fastapi>=0.116.0" \
    "uvicorn[standard]>=0.35.0" \
    "sqlalchemy>=2.0.43" \
    "asyncpg>=0.30.0" \
    "miniopy-async>=1.22.0" \
    "pydantic>=2.11.0" \
    "email-validator>=2.2.0" \
    "pydantic-settings>=2.10.0" \
    "python-dotenv>=1.1.0" \
    "python-multipart>=0.0.20" \
    "bcrypt>=4.3.0" \
    "google-genai>=1.14.0" \
    "playwright>=1.52.0" \
    "httpx>=0.27.0" \
    "google-cloud-storage>=3.4.1"

# Install Chromium for Playwright (needed for real execution)
RUN playwright install --with-deps chromium || true

# uvicorn --reload watches /app for changes — the source dir is
# mounted as a bind-mount from the host in docker-compose.yml
CMD ["uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"]
