# QA/SecOps (Suite Segura) — Playwright, API tests, Lint/SAST, ZAP, k6

Este guia é **para iniciantes** e foi desenhado para ser **NÃO destrutivo por padrão**.

## Regra de Ouro (nunca rode em produção)

Proteções implementadas no repositório:

- **Bloqueio de produção:** tudo que é scan/carga tem guardrail e **recusa** rodar quando o alvo contém `elementojuris.cloud`.
- **Opt-in explícito:** `QA_ALLOW_DANGEROUS=false` por padrão.
  - Se `QA_ALLOW_DANGEROUS != true`, **não roda**: ZAP baseline, k6 stress e cenários de upload.

Checklist pré-flight:

1) Confirme o alvo:
   - `E2E_BASE_URL` (Playwright)
   - `API_BASE_URL` (API tests)
   - `QA_TARGET_BASE_URL` (ZAP/k6)
2) Confirme que **não contém** `elementojuris.cloud`
3) Confirme se `QA_ALLOW_DANGEROUS` precisa mesmo estar `true` (normalmente **não**)

## Subir o ambiente local (recomendado)

Para manter **same-origin** (cookies HttpOnly funcionando), suba a stack com Traefik:

```bash
docker compose -f docker-compose.yml -f docker-compose.qa.yml up -d --build
```

Teste rápido:

```bash
curl -fsS http://localhost/api/health
```

Credenciais de demo (dev):

- Se `ENV=dev` + `SEED_ON_STARTUP=true`, o backend cria:
  - `admin@demo.example.com` / `admin12345`

## Comandos (local)

### 1) Check rápido (lint + unit + semgrep warn-only)

```bash
python -m pip install -r backend/requirements.txt -r backend/requirements-dev.txt
npm --prefix web ci
make check
```

### 2) API tests (integração, seguro)

```bash
API_BASE_URL=http://localhost make test-api
```

Write-tests (opcional):

- `API_ALLOW_WRITE=true` habilita testes que criam/alteram dados
- `API_SEED_STRATEGY=api` + `API_PLATFORM_ADMIN_KEY=...` habilita fixtures via `/api/v1/platform/*`

### 3) Playwright E2E (seguro)

```bash
E2E_BASE_URL=http://localhost make test-e2e
```

### 4) ZAP baseline (PASSIVO) — opt-in

Gera `artifacts/zap-report.html`.

```bash
QA_TARGET_BASE_URL=http://localhost QA_ALLOW_DANGEROUS=true make zap-baseline
```

### 5) k6 load tests — opt-in por perfil

Smoke (default):

```bash
QA_TARGET_BASE_URL=http://localhost make load-smoke
```

Load (opt-in):

```bash
QA_TARGET_BASE_URL=http://localhost make load-load
```

Stress (SÓ com opt-in):

```bash
QA_TARGET_BASE_URL=http://localhost QA_ALLOW_DANGEROUS=true make load-stress
```

Upload scenario (SÓ com opt-in + write):

```bash
QA_TARGET_BASE_URL=http://localhost QA_ALLOW_DANGEROUS=true K6_ALLOW_WRITE=true make load-upload-smoke
```

## Variáveis de ambiente (resumo)

- `E2E_BASE_URL` (default `http://localhost:3000`)
- `E2E_EMAIL`, `E2E_PASSWORD` (obrigatório fora de localhost)
- `E2E_ALLOW_WRITE=false` (default)
- `API_BASE_URL` (default `http://localhost:8000`)
- `API_TEST_EMAIL`, `API_TEST_PASSWORD` (obrigatório fora de localhost)
- `API_ALLOW_WRITE=false` (default)
- `API_SEED_STRATEGY=none` (default; `api|db|none`)
- `API_PLATFORM_ADMIN_KEY` (somente para `API_SEED_STRATEGY=api`)
- `QA_TARGET_BASE_URL` (obrigatório para ZAP/k6)
- `QA_ALLOW_DANGEROUS=false` (default; precisa ser `true` para ZAP/k6 stress)
- `K6_PROFILE=smoke|load|stress` (default smoke)
- `K6_EMAIL`, `K6_PASSWORD` (obrigatório fora de localhost)
- `K6_ALLOW_WRITE=false` (default; necessário para upload)

## CI (GitHub Actions)

- `/.github/workflows/ci.yml`
  - lint web (eslint)
  - lint backend (ruff)
  - unit tests (pytest)
  - semgrep (warn-only)
  - sobe stack via `docker compose` + `docker-compose.qa.yml`
  - API integration tests (safe)
  - Playwright headless (safe)

- `/.github/workflows/zap-baseline.yml`
  - manual (`workflow_dispatch`)
  - exige `qa_allow_dangerous=true`
  - bloqueia produção via `qa/scripts/guard_target.py`

## Burp (guia rápido)

Use **apenas** com `localhost/staging`.

1) Configure o proxy (Browser/OS):
   - Proxy HTTP/HTTPS: `127.0.0.1:8080` (padrão do Burp)
   - Instale o CA do Burp no browser (somente em ambiente de teste)
2) Fluxos para validar (prático):
   - Cookies: `HttpOnly`, `Secure` (em prod), `SameSite`, `Path` e escopo
   - Sessão: refresh/logout, expiração por inatividade, “session fixation”
   - CSRF: endpoints sensíveis (se houver cookies) e headers esperados
   - Rate limit/lockout: login/register (sem brute force)
   - Upload: allowlist MIME/ext, tamanho, nome do arquivo
3) Checklist OWASP Top 10 (mínimo):
   - A01 Broken Access Control (RBAC + tenant isolation)
   - A02 Cryptographic Failures (cookies/tokens)
   - A03 Injection (inputs de busca/cadastros)
   - A05 Security Misconfiguration (headers, CORS)
   - A07 Identification & Authentication Failures (login/refresh)

