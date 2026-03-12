# memoo Web (Next.js)

Frontend app for memoo.

- `/`: public landing page
- `/login`: login
- `/register`: register
- `/onboarding`: onboarding
- `/team/[teamId]`: product workspace
- `/team/[teamId]/automations`: manage scheduled/webhook playbook automations
- `/team/[teamId]/vault`: create credentials and get template keys for playbook variables

## Run locally

From monorepo root (`platform/`):

```bash
npm run web:install
npm run web:dev
```

Open `http://localhost:3000`.
