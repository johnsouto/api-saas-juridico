# Security Notes - Elemento Juris

Este documento resume os controles de seguranca da API sem alterar contratos de rotas existentes.

## Tenant Isolation

- A API usa `Depends(get_tenant_context)` no roteador `backend/app/api/v1/router.py`.
- O usuario autenticado e resolvido por `get_current_user` em `backend/app/api/deps.py`.
- Handlers de negocio filtram por `tenant_id` nas queries (`clients`, `processes`, `documents`, `honorarios`, `agenda`, `tarefas`, etc).
- Endpoints de plataforma (`/api/v1/platform/*`) usam `x-platform-admin-key` via `require_platform_admin`.

## RBAC

- O guard `require_roles(...)` em `backend/app/api/deps.py` aplica permissoes por role.
- Exemplo atual:
  - `users` e partes de `billing` exigem `admin`.
- O contrato de roles existente foi preservado.

## Auth Abuse Protection

Implementado em `backend/app/services/auth_security_service.py`:

- Rate limit para login/registro por:
  - IP
  - IP + identidade (email/username)
- Lockout leve por falha de login:
  - chave: IP + email
  - bloqueio temporario apos excesso de falhas

Variaveis de ambiente:

- `AUTH_RL_ENABLED=true`
- `AUTH_RL_WINDOW_SEC=60`
- `AUTH_RL_MAX=10`
- `AUTH_LOCKOUT_ENABLED=true`
- `AUTH_LOCKOUT_MAX_ATTEMPTS=5`
- `AUTH_LOCKOUT_MINUTES=10`

Mensagem publica quando excede:
- `Muitas tentativas. Tente novamente em instantes.`

## Login Error Exposure

- O endpoint `POST /api/v1/auth/login` responde externamente com mensagem generica:
  - `Credenciais invalidas.`
- Motivos internos permanecem no backend e nao sao expostos ao cliente.

## Upload Security

Implementado em `backend/app/services/upload_security_service.py`:

- Limite de tamanho por arquivo (hard limit via env).
- Allowlist de extensoes e MIME.
- Blocklist de extensoes executaveis.
- Sanitizacao de nome de arquivo para exibicao.
- Hook de scanner pronto (no-op por padrao).

Variaveis de ambiente:

- `UPLOAD_MAX_FILE_MB=25`
- `UPLOAD_ALLOWED_EXTENSIONS=pdf,doc,docx,jpg,jpeg,png,webp,xlsx,xls,txt`
- `UPLOAD_BLOCKED_EXTENSIONS=exe,js,bat,cmd,sh,dll,msi,com,scr,jar,ps1,vbs`
- `UPLOAD_ALLOWED_MIME_TYPES=...` (lista CSV)
- `UPLOAD_SCANNER_ENABLED=false`

## Audit Logging

- Listener em `backend/app/services/audit_service.py`.
- Modo minimalista habilitado por padrao:
  - grava somente metadados de campos alterados (`changed_fields`)
  - evita campos sensiveis (`senha_hash`, `token_hash`, `s3_key`, `email`, `documento`, etc)
- Escopo rastreado configuravel por env:
  - `AUDIT_TRACKED_TABLES=clients,processes,documents,honorarios,agenda_eventos,tarefas`
- Falha da auditoria e tratada como best-effort (nao deve bloquear operacao principal).

Variaveis de ambiente:

- `AUDIT_MINIMAL_MODE=true`
- `AUDIT_TRACKED_TABLES=clients,processes,documents,honorarios,agenda_eventos,tarefas`

## Plano Free Limits (Backend)

- Enforcements atuais em `backend/app/services/plan_limit_service.py`:
  - usuarios
  - clientes
  - storage
- Limites aplicados no backend (nao apenas no front).

## Testes Automatizados Adicionados

- `backend/tests/test_auth_security_service.py`
  - rate limit
  - lockout
- `backend/tests/test_authz_and_tenant.py`
  - bloqueio por role (`require_roles`)
  - query de cliente com filtro de tenant
- `backend/tests/test_upload_security_service.py`
  - bloqueio por extensao proibida
  - bloqueio por tamanho

## TODOs

- Integrar scanner real (ClamAV/servico externo) por implementacao de `FileScanner`.
- Avaliar lockout distribuido (Redis) para multi-instancia.
- Expandir suite de testes de integracao com banco real para cobertura de isolamento por endpoint.
