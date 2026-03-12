#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-europe-west1}"
STATE_BUCKET="${TF_STATE_BUCKET:-${PROJECT_ID}-memoo-tfstate}"

gcloud storage buckets create "gs://${STATE_BUCKET}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --uniform-bucket-level-access \
  >/dev/null 2>&1 || true

gcloud storage buckets update "gs://${STATE_BUCKET}" --versioning >/dev/null

printf 'Terraform state bucket ready: gs://%s\n' "${STATE_BUCKET}"
