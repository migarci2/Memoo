#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-europe-west1}"
PREFIX="${PREFIX:-memoo}"
REPOSITORY="${REPOSITORY:-${PREFIX}-containers}"
TAG="${TAG:-$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"

REGISTRY_HOST="${REGION}-docker.pkg.dev"
BASE_IMAGE_PATH="${REGISTRY_HOST}/${PROJECT_ID}/${REPOSITORY}"

gcloud auth configure-docker "${REGISTRY_HOST}" --quiet

gcloud services enable \
  artifactregistry.googleapis.com \
  --project="${PROJECT_ID}" \
  --quiet

if ! gcloud artifacts repositories describe "${REPOSITORY}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPOSITORY}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --repository-format=docker \
    --description="Container images for ${PREFIX}"
fi

docker build \
  -f "${ROOT_DIR}/apps/api/Dockerfile.prod" \
  -t "${BASE_IMAGE_PATH}/memoo-api:${TAG}" \
  "${ROOT_DIR}/apps/api"

docker build \
  -f "${ROOT_DIR}/apps/web/Dockerfile.prod" \
  -t "${BASE_IMAGE_PATH}/memoo-web:${TAG}" \
  "${ROOT_DIR}/apps/web"

docker build \
  -f "${ROOT_DIR}/apps/agent/Dockerfile" \
  -t "${BASE_IMAGE_PATH}/memoo-agent:${TAG}" \
  "${ROOT_DIR}/apps/agent"

docker build \
  -f "${ROOT_DIR}/apps/sandbox/Dockerfile" \
  -t "${BASE_IMAGE_PATH}/memoo-sandbox:${TAG}" \
  "${ROOT_DIR}/apps/sandbox"

docker push "${BASE_IMAGE_PATH}/memoo-api:${TAG}"
docker push "${BASE_IMAGE_PATH}/memoo-web:${TAG}"
docker push "${BASE_IMAGE_PATH}/memoo-agent:${TAG}"
docker push "${BASE_IMAGE_PATH}/memoo-sandbox:${TAG}"

printf 'API_IMAGE=%s\n' "${BASE_IMAGE_PATH}/memoo-api:${TAG}"
printf 'WEB_IMAGE=%s\n' "${BASE_IMAGE_PATH}/memoo-web:${TAG}"
printf 'AGENT_IMAGE=%s\n' "${BASE_IMAGE_PATH}/memoo-agent:${TAG}"
printf 'SANDBOX_IMAGE=%s\n' "${BASE_IMAGE_PATH}/memoo-sandbox:${TAG}"
