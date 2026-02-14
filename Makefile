COMPOSE ?= docker compose

.PHONY: up down ps logs api-logs web-logs restart build migrate rev seed api-shell web-shell \
	test-api test-backend test-e2e test-e2e-ui \
	lint-web lint-backend format-backend typecheck-backend \
	semgrep semgrep-strict \
	check check-api \
	clean-web-cache clean-backend-cache clean-temp-cache clean-docker-cache clean-cache \
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

clean-web-cache:
	npm --prefix web run clean:cache

clean-backend-cache:
	find backend app \( -path "*/uploads" -o -path "*/uploads/*" \) -prune -o -type d -name "__pycache__" -exec rm -rf {} +
	find backend app \( -path "*/uploads" -o -path "*/uploads/*" \) -prune -o -type f -name "*.pyc" -delete
	find backend -type d \( -name ".pytest_cache" -o -name ".mypy_cache" -o -name ".ruff_cache" \) -exec rm -rf {} +
	find backend -type d \( -name "build" -o -name "dist" -o -name "*.egg-info" \) -exec rm -rf {} +
	find backend -type f -name ".coverage" -delete
	find . -maxdepth 1 -type d -name ".ruff_cache" -exec rm -rf {} +

clean-temp-cache:
	rm -rf web/playwright-report web/test-results web/artifacts

clean-docker-cache:
	docker image prune -f
	docker builder prune -f

clean-cache:
	$(MAKE) clean-web-cache
	$(MAKE) clean-backend-cache
	$(MAKE) clean-temp-cache

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
