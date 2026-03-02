.PHONY: setup dev dev-docker db-up db-down db-reset logs api-install api-dev seed web-install web-dev web-build web-lint

setup: web-install api-install

# Local dev (runs API + web directly on the host)
dev:
	npm run dev

# Full Docker dev (everything containerised, live-reload via bind-mounts)
dev-docker:
	docker compose up --build

db-up:
	docker compose up -d

db-down:
	docker compose down

db-reset:
	docker compose down -v
	docker compose up -d

logs:
	docker compose logs -f

api-install:
	npm run api:install

api-dev:
	npm run api:dev

seed:
	npm run api:seed

web-install:
	npm run web:install

web-dev:
	npm run web:dev

web-build:
	npm run web:build

web-lint:
	npm run web:lint
