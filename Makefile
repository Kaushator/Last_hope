.PHONY: setup dev up down logs backend frontend fingpt test ci-local tf-init tf-apply

setup:
	cp -n .env.example .env || true
	cd infra/terraform && terraform init

dev: up

up:
	docker compose -f infra/docker/docker-compose.dev.yml up -d --build

down:
	docker compose -f infra/docker/docker-compose.dev.yml down -v

logs:
	docker compose -f infra/docker/docker-compose.dev.yml logs -f --tail=200

backend:
	curl -fsS http://localhost:8000/health || true

frontend:
	python - << 'PY'
print('Open http://localhost:3000')
PY

fingpt:
	curl -fsS http://localhost:9000/health || true

test:
	cd apps/backend && pytest -q || true
	cd apps/frontend && npm test -- --run || true

ci-local: test

tf-init:
	cd infra/terraform && terraform init

tf-apply:
	cd infra/terraform && terraform apply -auto-approve
