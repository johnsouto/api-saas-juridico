COMPOSE ?= docker compose

.PHONY: up down ps logs api-logs web-logs restart build migrate rev seed api-shell web-shell \
	test-api test-backend \
	lint-web lint-backend format-backend typecheck-backend \
	semgrep semgrep-strict \
	check check-api

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

ps:
	$(COMPOSE) ps

logs:
	$(COMPOSE) logs -f --tail=200

api-logs:
	$(COMPOSE) logs -f --tail=200 api

web-logs:
	$(COMPOSE) logs -f --tail=200 web

restart:
	$(COMPOSE) restart

build:
	$(COMPOSE) build

migrate:
	$(COMPOSE) exec api alembic upgrade head

rev:
	$(COMPOSE) exec api alembic revision --autogenerate -m "$(msg)"

seed:
	$(COMPOSE) exec api python -m app.seed

api-shell:
	$(COMPOSE) exec api sh

web-shell:
	$(COMPOSE) exec web sh

test-api:
	pytest -q backend/tests_api

test-backend:
	pytest -q backend/tests

lint-web:
	npm --prefix web run lint

lint-backend:
	cd backend && ruff check app tests tests_api

format-backend:
	cd backend && ruff format app tests tests_api

typecheck-backend:
	cd backend && mypy

semgrep:
	# Warn-only by default (non-blocking). Use `make semgrep-strict` for a failing run.
	semgrep --config p/owasp-top-ten --metrics=off || true

semgrep-strict:
	semgrep --config p/owasp-top-ten --metrics=off

check:
	$(MAKE) lint-web
	$(MAKE) lint-backend
	$(MAKE) test-backend
	$(MAKE) semgrep

check-api:
	$(MAKE) check
	$(MAKE) test-api
