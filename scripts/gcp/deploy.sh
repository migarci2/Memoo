#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="${ROOT_DIR}/infra/terraform/gcp"

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-europe-west1}"
ZONE="${ZONE:-${REGION}-b}"
PREFIX="${PREFIX:-memoo}"
REPOSITORY="${REPOSITORY:-${PREFIX}-containers}"
TAG="${TAG:-$(git -C "${ROOT_DIR}" rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"

REGISTRY_HOST="${REGION}-docker.pkg.dev"
BASE_IMAGE_PATH="${REGISTRY_HOST}/${PROJECT_ID}/${REPOSITORY}"
API_IMAGE="${API_IMAGE:-${BASE_IMAGE_PATH}/memoo-api:${TAG}}"
WEB_IMAGE="${WEB_IMAGE:-${BASE_IMAGE_PATH}/memoo-web:${TAG}}"
AGENT_IMAGE="${AGENT_IMAGE:-${BASE_IMAGE_PATH}/memoo-agent:${TAG}}"
SANDBOX_IMAGE="${SANDBOX_IMAGE:-${BASE_IMAGE_PATH}/memoo-sandbox:${TAG}}"

gcloud services enable \
  artifactregistry.googleapis.com \
  billingbudgets.googleapis.com \
  cloudbilling.googleapis.com \
  cloudresourcemanager.googleapis.com \
  compute.googleapis.com \
  iam.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  serviceusage.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  vpcaccess.googleapis.com \
  --project="${PROJECT_ID}" \
  --quiet

"${ROOT_DIR}/scripts/gcp/build_and_push.sh"

cd "${TF_DIR}"

if [[ -n "${TF_STATE_BUCKET:-}" ]]; then
  terraform init -upgrade \
    -backend-config="bucket=${TF_STATE_BUCKET}" \
    -backend-config="prefix=${TF_STATE_PREFIX:-memoo/gcp}"
else
  terraform init -upgrade
fi

export GOOGLE_CLOUD_PROJECT="${PROJECT_ID}"
export CLOUDSDK_CORE_PROJECT="${PROJECT_ID}"
export GOOGLE_CLOUD_QUOTA_PROJECT="${PROJECT_ID}"
gcloud auth application-default set-quota-project "${PROJECT_ID}" --quiet >/dev/null 2>&1 || true

if gcloud artifacts repositories describe "${REPOSITORY}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  >/dev/null 2>&1; then
  if ! terraform state show google_artifact_registry_repository.containers >/dev/null 2>&1; then
    terraform import \
      google_artifact_registry_repository.containers \
      "projects/${PROJECT_ID}/locations/${REGION}/repositories/${REPOSITORY}" \
      >/dev/null
  fi
fi

TF_ARGS=()

if [[ -n "${TF_VARS_FILE:-}" ]]; then
  TF_ARGS+=("-var-file=${TF_VARS_FILE}")
fi

TF_ARGS+=(
  "-var=project_id=${PROJECT_ID}"
  "-var=region=${REGION}"
  "-var=zone=${ZONE}"
  "-var=prefix=${PREFIX}"
  "-var=api_image=${API_IMAGE}"
  "-var=web_image=${WEB_IMAGE}"
  "-var=agent_image=${AGENT_IMAGE}"
  "-var=sandbox_image=${SANDBOX_IMAGE}"
)

if [[ -n "${GOOGLE_API_KEY:-}" ]]; then
  TF_ARGS+=("-var=google_api_key=${GOOGLE_API_KEY}")
fi

if [[ -n "${NEXT_PUBLIC_GEMINI_API_KEY:-}" ]]; then
  TF_ARGS+=("-var=next_public_gemini_api_key=${NEXT_PUBLIC_GEMINI_API_KEY}")
fi

if [[ -n "${SANDBOX_DOMAIN:-}" ]]; then
  TF_ARGS+=("-var=sandbox_domain=${SANDBOX_DOMAIN}")
fi

if [[ "${AUTO_APPROVE:-false}" == "true" ]]; then
  TF_ARGS+=("-auto-approve")
fi

terraform apply "${TF_ARGS[@]}"
