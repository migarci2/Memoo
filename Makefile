.PHONY: setup dev db-up db-down api-install api-dev seed web-install web-dev web-build web-lint

setup: web-install api-install

dev:
	npm run dev

db-up:
	docker compose up -d

db-down:
	docker compose down

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
