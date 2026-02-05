# SaaS Jurídico (Multi-tenant) — Monorepo

Este repo contém:
- `backend/`: FastAPI + SQLAlchemy 2.0 (Async) + Alembic + PostgreSQL + MinIO (S3)
- `web/`: Next.js (App Router) + TypeScript + Tailwind + TanStack Query
- `docker-compose.yml`: Postgres + MinIO + API + Web + Traefik (reverse proxy)

## Subir Tudo (Docker)

1. Copie `.env.example` para `.env` (opcional — o repo já inclui `.env` com valores dev).
2. Suba a stack:

```bash
docker compose up -d --build
```

URLs:
- App (HTTP): `http://localhost/`
- API (HTTP): `http://localhost/api/v1`
- Docs (HTTP): `http://localhost/api/docs`
- App (HTTPS): `https://localhost/` (certificado autoassinado do Traefik)
- Traefik dashboard: `http://localhost:8080`
- MinIO: `http://localhost:9001`

> Em LAN, use `http://SEU_IP_DA_MAQUINA/` e `http://SEU_IP_DA_MAQUINA/api` (evita mixed-content nos links presigned do MinIO).  
> Se preferir HTTPS, mantenha `https://...` e ajuste `S3_PUBLIC_ENDPOINT_URL` para um endpoint HTTPS alcançável pelo browser.

## Comandos (Makefile)

```bash
make up
make logs
make migrate
make seed
```
