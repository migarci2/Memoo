.PHONY: dev up down logs logs-api logs-web migrate shell-api shell-web shell-db clean rebuild seed prod-up prod-down prod-logs prod-logs-traefik prod-ps gcp-bootstrap-state gcp-build-push gcp-deploy

# Start all services in development mode
dev: up
	@echo "memoo is running!"
	@echo "  Frontend: http://localhost:3000"
	@echo "  Backend:  http://localhost:8000"
	@echo "  API Docs: http://localhost:8000/docs"

# Start containers
up:
	docker compose up -d

# Stop containers
down:
	docker compose down

# View logs
logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

logs-web:
	docker compose logs -f web

# Production with Traefik + Let's Encrypt
prod-up:
	docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

prod-down:
	docker compose --env-file .env.prod -f docker-compose.prod.yml down

prod-logs:
	docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f

prod-logs-traefik:
	docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f traefik

prod-ps:
	docker compose --env-file .env.prod -f docker-compose.prod.yml ps

# Shell access
shell-api:
	docker compose exec api bash

shell-web:
	docker compose exec web sh

shell-db:
	docker compose exec postgres psql -U memoo -d memoo

# Clean everything (including volumes)
clean:
	docker compose down -v --rmi local
	@echo "Cleaned up containers, volumes, and images"

# Rebuild without cache
rebuild:
	docker compose build --no-cache
	docker compose up -d

# Seed demo data
seed:
	docker compose exec api python -m scripts.seed_demo

prod-seed:
	docker compose --env-file .env.prod -f docker-compose.prod.yml exec api python -m scripts.seed_demo

gcp-bootstrap-state:
	./scripts/gcp/bootstrap_tf_state.sh

gcp-build-push:
	./scripts/gcp/build_and_push.sh

gcp-deploy:
	./scripts/gcp/deploy.sh
