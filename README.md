# SaaS Jurídico (Multi-tenant) — Monorepo (FastAPI + Next.js + Docker)

Plataforma SaaS para escritórios de advocacia (multi-tenant), com provisionamento via **Super-admin** (`/platform`), autenticação JWT, RBAC, armazenamento S3 (MinIO) e módulos jurídicos (clientes, processos, honorários, agenda, tarefas, documentos).

## Visão Geral

Este repositório contém:

- `backend/`: FastAPI + SQLAlchemy 2.0 (Async) + Alembic + PostgreSQL + MinIO (S3), RBAC, limites por plano, auditoria e relatórios `.xlsx`
- `web/`: Next.js (App Router) + TypeScript + Tailwind + TanStack Query + Axios + React Hook Form + Zod
- `docker-compose.yml`: Postgres + MinIO + API + Web + Traefik (reverse proxy / HTTPS)

Arquitetura local (simulando produção):

- **Traefik** publica `http://localhost` e encaminha:
  - `/api/*` → `api`
  - `/*` → `web`
- **PostgreSQL** persiste dados em volume
- **MinIO** persiste arquivos em volume (S3 compatível)

## Principais Funcionalidades

- Multi-tenancy (isolamento lógico via `tenant_id`)
- Auth: JWT (access/refresh) + OAuth2PasswordBearer
- RBAC: `admin`, `advogado`, `financeiro`
- Provisionamento (Super-admin):
  - `GET /platform` (UI) + endpoints `/api/v1/platform/*`
  - Criar tenant com senha inicial **ou** criar tenant Free e enviar **convite de 1º acesso**
- Módulos:
  - Clientes (busca por nome/CPF)
  - Processos (status: `ativo`, `inativo`, `outros`; nicho; opção com/sem parceria)
  - Parcerias (parceiros com CPF/CNPJ e vínculo ao processo)
  - Honorários (valor inicial, parcelas, data início pagamento, % êxito, % parceiro)
  - Agenda (evento opcionalmente vinculado a cliente; atalhos para tipos de evento)
  - Tarefas (kanban simples; opcionalmente vinculada a cliente)
  - Documentos (upload para MinIO; presigned URL; busca por nome; modelos como “declaração de pobreza”)
- Planos:
  - `plans` + `subscriptions`
  - Limites: usuários / storage (enforced no backend)
- Auditoria:
  - Logs automáticos de CREATE/UPDATE/DELETE em `audit_logs`
- Relatórios:
  - Export `.xlsx` via endpoint de reports (baixável pelo dashboard)

## Rodar Localmente (Docker Compose)

1. Crie `.env` na raiz (recomendado). Você pode partir do `.env.example`.

2. Suba a stack:

```bash
docker compose up -d --build
```

3. Acesse:

- App (Traefik): `http://localhost/`
- Super-admin (UI): `http://localhost/platform`
- API base: `http://localhost/api/v1`
- Swagger: `http://localhost/api/docs`
- Traefik dashboard: `http://localhost:8080`
- MinIO console: `http://localhost:9001`

Observações:

- Se você subir só `api` e `web` sem `traefik`, `http://localhost/...` pode não responder (porque o Traefik é quem expõe as portas 80/443). Suba com `docker compose up -d traefik`.
- Para acesso em LAN: use `http://SEU_IP/` e defina `S3_PUBLIC_ENDPOINT_URL` para um endpoint que o browser consiga alcançar (evita mixed-content em presigned URL).

## Variáveis de Ambiente

Arquivos de exemplo:

- `.env.example` (raiz / compose)
- `backend/.env.example`
- `web/.env.example`

### Chaves Importantes

- `PLATFORM_ADMIN_KEY`
  - Habilita endpoints `/api/v1/platform/*`
  - A UI em `/platform` salva essa chave no `localStorage` e envia via header `x-platform-admin-key`
  - Em dev (`ENV=dev`), existe fallback para `dev-platform-key` se você não definir nada

- SMTP (para convites e 1º acesso):
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`
  - `EMAIL_FROM`, `EMAIL_FROM_NAME`

Importante (segurança):

- **Nunca** commitar `.env` (já está no `.gitignore`).
- Se você compartilhou senha de app (Gmail) em chat/prints, trate como comprometida: **revogue e gere outra**.

## Como Cadastrar Escritórios (Tenants) e Usuários

### Acesso Super-admin

1. Vá em `http://localhost/platform`
2. Cole `PLATFORM_ADMIN_KEY` (a mesma do seu `.env`)
3. Clique em “Salvar chave”

### Criar um escritório (tenant)

Existem 2 jeitos:

1. **Criar (com senha)**:
  - Você define uma senha inicial para o admin
  - O admin já consegue logar direto em `/login`

2. **Criar Free + enviar convite (1º acesso)**:
  - Você cria o tenant sem senha
  - O sistema envia e-mail com link para `/accept-invite?token=...`
  - O usuário define a senha no primeiro acesso

### Escritório sem CNPJ (pessoa física)

Na criação do tenant, selecione:

- Tipo: `CPF`
- Documento: CPF do responsável

## Comandos Úteis (Makefile)

```bash
make up
make logs
make migrate
make seed
```

## GitHub Pages (Importante)

GitHub Pages (`https://johnsouto.github.io/api-saas-juridico`) serve **apenas conteúdo estático**.

Isso significa:

- Serve bem para **landing page** e documentação
- **Não** executa FastAPI, PostgreSQL, MinIO nem Docker Compose

Para rodar o SaaS de verdade, você precisa de um ambiente com runtime (VPS/Cloud).

## Deploy em Produção (Recomendação Prática)

Para vender e não depender do notebook ligado, o caminho mais simples é uma **VPS** com Docker:

1. Criar uma VPS (1–2 GB RAM serve para MVP / poucos clientes)
2. Instalar Docker + Docker Compose
3. Copiar o projeto (git clone) e subir:
   - `docker compose up -d --build`
4. Configurar domínio e TLS (Traefik já suporta)
5. Usar Postgres/MinIO persistidos em volumes do servidor

Alternativa mais “gerenciada”:

- Postgres gerenciado (Neon/Supabase)
- S3 gerenciado (Cloudflare R2 / Backblaze B2)
- API (Render/Fly.io)
- Frontend (Vercel)

## Troubleshooting

- “Plataforma não habilitada”
  - Falta `PLATFORM_ADMIN_KEY` no ambiente do backend **ou** você está enviando a chave errada no header.

- “Connection refused” em `http://localhost/...`
  - Traefik não está rodando. Faça:
    - `docker compose up -d traefik`

- `docker compose ps` mostra `5/6` “Up”
  - `minio-init` é um container “one-shot”: cria bucket e sai com status `Exited(0)`. Isso é esperado.

## Licença

Uso e licença: defina conforme seu modelo comercial (privado / open-source / dual-license).

