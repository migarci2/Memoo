# memoo API (FastAPI)

## Run

```bash
cd platform
npm run api:install
npm run api:dev
```

## Seed demo data

```bash
cd platform
npm run api:seed
```

## Playbook automations

Automations run playbooks automatically using existing run execution (sandbox or headless):

- `GET /api/teams/{team_id}/automations`
- `POST /api/teams/{team_id}/automations`
- `PATCH /api/automations/{automation_id}`
- `DELETE /api/automations/{automation_id}`
- `POST /api/automations/{automation_id}/run`
- `POST /api/automations/webhook/{webhook_token}`

The interval scheduler runs in the API process at startup and polls due automations.

### Vault linking

- `RunCreate.selected_vault_credential_ids` links runs to specific vault credentials.
- `PlaybookAutomation.selected_vault_credential_ids` links automations to specific vault credentials.
- Vault list responses now include `template_key` (e.g. `vault_google_admin`) to reference in playbook step templates as `{{vault_google_admin}}`.
