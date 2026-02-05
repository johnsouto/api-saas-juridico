COMPOSE ?= docker compose

.PHONY: up down ps logs api-logs web-logs restart build migrate rev seed api-shell web-shell

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
