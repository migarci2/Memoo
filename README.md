# Memoo

Memoo is a UI Navigator product for repeated browser work. A teammate performs a workflow once in Teach Mode, Memoo watches the screen, listens for voice context, compiles the session into a reusable playbook, and then replays that playbook in a live sandbox with evidence for every step.

## Why It Scores Well For UI Navigator

- Beyond text: the core interaction is screen capture + live voice + browser execution, not a chat box.
- Visual precision: Teach Mode uses Gemini vision to detect on-screen actions and surface grounding cues instead of blind clicking.
- Multimodal feel: Navigator Live can hear spoken context, respond in voice, and react to newly detected screen events in the same session.
- Proof over claims: runs can execute in a visible sandbox and persist screenshot evidence per step.
- Cloud-native backend: the stack is designed for Google Cloud with Cloud Run, Cloud SQL, GCS, Secret Manager, Artifact Registry, Cloud Build, and a sandbox VM for noVNC/CDP.

## Product Surfaces

- `apps/web`: Next.js App Router frontend
- `apps/api`: FastAPI backend, Gemini services, run engine, capture compiler
- `apps/agent`: Stagehand-compatible autonomous browser agent service
- `apps/sandbox`: visible Chromium sandbox for live noVNC playback
- `infra/terraform/gcp`: Google Cloud deployment stack
- `infra/diagrams/memoo_gcp_architecture.svg`: architecture diagram for the demo/submission

## Core Flow

1. Teach Mode records a live screen session.
2. Gemini vision detects grounded browser actions from frames.
3. Navigator Live captures spoken context and clarifications.
4. Gemini compile turns the session into structured playbook steps.
5. Runs execute inside a live sandbox or headless browser.
6. Each run emits step-by-step evidence and screenshots.

## Local Quickstart

From the repository root:

```bash
make db-up
npm run setup
```

Run the apps:

```bash
make api-dev
make web-dev
```

Or run both together:

```bash
npm run dev
```

Seed demo data:

```bash
make seed
```

## Workspace Scripts

- `npm run dev`
- `npm run web:dev`
- `npm run web:build`
- `npm run web:lint`
- `npm run api:dev`
- `npm run api:seed`
- `npm run db:up`
- `npm run db:down`

## Environment

Backend in `apps/api/.env`:

- `DATABASE_URL`
- `GOOGLE_API_KEY`
- `GEMINI_LIVE_MODEL`
- `STORAGE_BACKEND`

Frontend in `apps/web/.env.local`:

- `NEXT_PUBLIC_API_BASE_URL`
- `GOOGLE_GENERATIVE_AI_API_KEY`

## Google Cloud Deployment

Memoo ships with a Google Cloud deployment stack under `infra/terraform/gcp`:

- Web -> Cloud Run
- API -> Cloud Run
- Postgres -> Cloud SQL
- Evidence assets -> Google Cloud Storage
- Visible browser sandbox -> Compute Engine VM
- Secrets -> Secret Manager
- Images -> Artifact Registry
- Pipeline -> Cloud Build

Start with:

```bash
export PROJECT_ID="your-project"
export REGION="europe-west1"
./scripts/gcp/bootstrap_tf_state.sh
./scripts/gcp/deploy.sh
```

Detailed deployment notes live in `infra/terraform/gcp/README.md`.

## Demo Checklist

- Show Teach Mode detecting actions from the screen in real time.
- Turn on Navigator Live and speak extra context while recording.
- Compile the capture into a playbook.
- Launch a run in the visible sandbox.
- Open the run detail page and show screenshot evidence per step.
- Flash the GCP architecture diagram and Cloud Build / Cloud Run / Cloud SQL resources during the video.
