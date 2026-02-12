COMPOSE ?= docker compose

.PHONY: up down ps logs api-logs web-logs restart build migrate rev seed api-shell web-shell \
	test-api test-backend test-e2e test-e2e-ui \
	lint-web lint-backend format-backend typecheck-backend \
	semgrep semgrep-strict \
	check check-api \
	zap-baseline \
	load-smoke load-load load-stress load-upload-smoke

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

test-e2e:
	npm --prefix web run test:e2e

test-e2e-ui:
	npm --prefix web run test:e2e:ui

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

zap-baseline:
	python qa/scripts/guard_target.py --require-allow-dangerous
	$(COMPOSE) -f qa/zap/docker-compose.zap.yml run --rm zap-baseline

load-smoke:
	python qa/scripts/guard_target.py
	$(COMPOSE) -f qa/load/docker-compose.k6.yml run --rm \
		-e QA_TARGET_BASE_URL -e QA_ALLOW_DANGEROUS -e K6_EMAIL -e K6_PASSWORD \
		k6 run -e K6_PROFILE=smoke qa/load/suite.js

load-load:
	python qa/scripts/guard_target.py
	$(COMPOSE) -f qa/load/docker-compose.k6.yml run --rm \
		-e QA_TARGET_BASE_URL -e QA_ALLOW_DANGEROUS -e K6_EMAIL -e K6_PASSWORD \
		k6 run -e K6_PROFILE=load qa/load/suite.js

load-stress:
	python qa/scripts/guard_target.py --require-allow-dangerous
	$(COMPOSE) -f qa/load/docker-compose.k6.yml run --rm \
		-e QA_TARGET_BASE_URL -e QA_ALLOW_DANGEROUS -e K6_EMAIL -e K6_PASSWORD \
		k6 run -e K6_PROFILE=stress qa/load/suite.js

load-upload-smoke:
	python qa/scripts/guard_target.py --require-allow-dangerous
	$(COMPOSE) -f qa/load/docker-compose.k6.yml run --rm \
		-e QA_TARGET_BASE_URL -e QA_ALLOW_DANGEROUS -e K6_EMAIL -e K6_PASSWORD -e K6_ALLOW_WRITE \
		k6 run -e K6_PROFILE=smoke qa/load/upload-small.js
