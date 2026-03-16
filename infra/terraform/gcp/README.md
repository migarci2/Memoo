# memoo on Google Cloud

This stack adapts the current monorepo to GCP with a split that matches the app's actual runtime constraints:

- `apps/web` -> `Cloud Run`
- `apps/api` -> `Cloud Run`
- PostgreSQL -> `Cloud SQL for PostgreSQL`
- MinIO -> `Google Cloud Storage`
- Visible browser sandbox -> `Compute Engine` VM running the existing sandbox container
- Images -> `Artifact Registry`
- Secrets -> `Secret Manager`

## Why the sandbox stays on a VM

The sandbox exposes two distinct surfaces:

- a DevTools/CDP port for the API
- a noVNC session for the user

That combination does not fit well into a single serverless service. The Terraform stack therefore puts the sandbox on a dedicated VM and fronts noVNC with `Caddy` over HTTPS. By default it uses `sslip.io`, so you do not need a custom DNS record just to get started.

## What changed in the app

- The API now supports `STORAGE_BACKEND=gcs` and writes to GCS natively.
- Database config can be injected as `DB_*` pieces instead of only `DATABASE_URL`, which is needed for Cloud SQL sockets on Cloud Run.
- The web app now loads its public runtime config at request time and proxies browser API traffic through Next.js at `/api/proxy`, so the browser no longer depends on CORS between two `run.app` URLs.

## Files

- `infra/terraform/gcp`: Terraform stack
- `scripts/gcp/bootstrap_tf_state.sh`: creates the GCS bucket for remote Terraform state
- `scripts/gcp/build_and_push.sh`: builds and pushes `web`, `api`, and `sandbox`
- `scripts/gcp/deploy.sh`: end-to-end build + terraform apply
- `cloudbuild.yaml`: managed pipeline that runs the same deploy flow inside Google Cloud Build

## Prerequisites

- `gcloud`, `docker`, and `terraform` installed locally
- Artifact Registry, Cloud Run, Cloud SQL, Secret Manager, Compute Engine, and VPC Access APIs enabled
  Terraform enables them too, but your identity still needs permission to do so
- A logged-in gcloud session targeting the right project

## Quick start

1. Bootstrap Terraform state:

```bash
export PROJECT_ID="your-project"
export REGION="europe-west1"
./scripts/gcp/bootstrap_tf_state.sh
```

2. Copy the example tfvars:

```bash
cp infra/terraform/gcp/terraform.tfvars.example infra/terraform/gcp/terraform.tfvars
```

3. Fill at least:

- `project_id`
- `api_image`
- `web_image`
- `sandbox_image`
- `google_api_key`

4. Create the Artifact Registry repository and the rest of the infra:

```bash
export PROJECT_ID="your-project"
export REGION="europe-west1"
export TF_STATE_BUCKET="${PROJECT_ID}-memoo-tfstate"
export AUTO_APPROVE=true
./scripts/gcp/deploy.sh
```

`build_and_push.sh` now creates the Artifact Registry repository automatically if it does not exist yet, so the very first deploy can use the same command.

If you prefer, build and push separately:

```bash
export PROJECT_ID="your-project"
export REGION="europe-west1"
./scripts/gcp/build_and_push.sh

cd infra/terraform/gcp
terraform init -backend-config="bucket=${PROJECT_ID}-memoo-tfstate" -backend-config="prefix=memoo/gcp"
terraform apply -var-file=terraform.tfvars
```

## Fast path with Cloud Build

If you want to avoid installing `terraform` locally, you can run the deployment entirely in Google Cloud Build:

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions=_REGION=europe-west1,_ZONE=europe-west1-b,_PREFIX=memoo,_GOOGLE_API_KEY=your-key,_NEXT_PUBLIC_GEMINI_API_KEY=your-key
```

Notes:

- The pipeline bootstraps the Terraform state bucket automatically.
- If `infra/terraform/gcp/terraform.tfvars` is already committed or present in the workspace, Cloud Build uses it.
- If `terraform.tfvars` is missing, the pipeline copies `terraform.tfvars.example` first, so you should still override the important values either in that file or via script environment.

## Important notes

- The current Terraform creates secret versions directly from variables. That is convenient, but the values end up in Terraform state. Use a protected remote state bucket and restrict access to it.
- If you want stricter secret hygiene later, split secret material out of Terraform and inject versions via `gcloud secrets versions add`.
- The sandbox is exposed over HTTPS, but CDP stays private inside the VPC and is only reachable by the API service through the Serverless VPC connector.
- If you need a custom sandbox hostname later, set `sandbox_domain`.
