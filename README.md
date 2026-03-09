# Memoo Platform

Full-stack foundation for the Memoo product:
- Frontend: Next.js App Router + Vercel AI SDK
- Backend: FastAPI + SQLAlchemy
- Data: PostgreSQL (Docker) or SQLite for local quick start
- Capture: Gemini Live capture infrastructure (REST + WebSocket ingestion)

This repository is a monorepo centered in `platform/`.

## Structure

- `apps/web`: Next.js frontend, including the public landing page at `/`
- `apps/api`: FastAPI backend, DB models, seed scripts
- `packages/*`: shared packages for frontend and tooling
- `docker-compose.yml`: local PostgreSQL + Adminer
- `package.json`: monorepo workspace scripts (run everything from `platform/`)

## Quickstart (from monorepo root)

```bash
cd platform
make db-up
npm run setup
```

Run apps in separate terminals:

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

Web app: `http://localhost:3000`
API: `http://localhost:8000`

## Workspace scripts

- `npm run web:dev`
- `npm run web:build`
- `npm run web:lint`
- `npm run dev` (api + web)
- `npm run api:dev`
- `npm run api:seed`
- `npm run db:up`
- `npm run db:down`

## Environment keys

### Backend (`apps/api/.env`)
- `DATABASE_URL`
- `GOOGLE_API_KEY` (for Gemini Live server integration)
- `GEMINI_LIVE_MODEL`

### Frontend (`apps/web/.env.local`)
- `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000/api`)
- `GOOGLE_GENERATIVE_AI_API_KEY` (for Vercel AI SDK routes)

## Playbook Automations

The API now supports automated playbook execution in sandbox/headless mode:

- Interval scheduler (background polling in API process)
- Webhook trigger
- Manual "run now" trigger for any automation

Core endpoints:

- `GET /api/teams/{team_id}/automations`
- `POST /api/teams/{team_id}/automations`
- `PATCH /api/automations/{automation_id}`
- `POST /api/automations/{automation_id}/run`
- `POST /api/automations/webhook/{webhook_token}`
