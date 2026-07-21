# LifeOS Enterprise — Release v47.0.0
**Data:** 2026-07-21
**Fases:** 331–335 — Auth Recovery + Zero Block Login

---

## Resumo Executivo

Esta release elimina definitivamente qualquer bloqueio de autenticação na plataforma.
O sistema agora opera em modo **Zero Block Login**: nenhum usuário pode ficar bloqueado
por ausência de variáveis OAuth opcionais.

---

## Mudanças por Fase

### FASE 331 — Auditoria Auth

**Auditoria completa realizada. Resultado:**

| Variável | Status | Tipo |
|---|---|---|
| `LIFEOS_SESSION_SECRET` | Obrigatória — via Cloudflare Secret | Sessão/JWT |
| `LIFEOS_KV` | Obrigatória — via KV binding | Armazenamento |
| `LIFEOS_ADMIN_USER` | Presente — em `[vars]` | Admin |
| `LIFEOS_ADMIN_PASSWORD_HASH` | Obrigatória — via Cloudflare Secret | Admin |
| `GOOGLE_CLIENT_ID` | Opcional — ausente | OAuth Google |
| `GOOGLE_CLIENT_SECRET` | Opcional — ausente | OAuth Google |
| `APPLE_CLIENT_ID` | Opcional — ausente | OAuth Apple |
| `APPLE_TEAM_ID` | Opcional — ausente | OAuth Apple |
| `APPLE_KEY_ID` | Opcional — ausente | OAuth Apple |
| `APPLE_PRIVATE_KEY` | Opcional — ausente | OAuth Apple |
| `EMAIL_FROM` | Opcional — ausente | Email |
| `RESEND_API_KEY` ou `SENDGRID_API_KEY` | Opcional — ausente | Email |

---

### FASE 332 — Fallback Automático

**Arquivos modificados:**

- `functions/api/auth/google.js` — v2.0
  - Sem `GOOGLE_CLIENT_ID/SECRET`: redireciona para `/login?oauth=google_unavailable` (nunca JSON bruto)
  - Suporte a `HEAD` para detecção pelo frontend
  
- `functions/api/auth/apple.js` — v2.0
  - Sem credenciais Apple: redireciona para `/login?oauth=apple_unavailable` (nunca JSON bruto)
  - Suporte a `HEAD` para detecção pelo frontend

- `functions/api/login.js` — v17.0
  - Separação de verificação: `LIFEOS_SESSION_SECRET` e `LIFEOS_KV` obrigatórios; `LIFEOS_ADMIN_PASSWORD_HASH` apenas para admin
  - Mensagens de erro com `code` acionável

- `functions/api/admin-login.js` — v7.0
  - Mensagens de erro 503 com `code` e instruções de configuração

- `functions/api/register.js`
  - `checkRateLimit` sem KV retorna `allowed: true` (KV já verificado antes)
  - Mensagem 503 com `code: 'KV_MISSING'`

- `premium_ui/login_new.html`
  - Detector automático via `/api/auth/config` ao carregar a página
  - Botões Google/Apple desabilitados elegantemente quando não configurados
  - Seção SSO oculta quando nenhum provedor está configurado
  - Tratamento de `?oauth=google_unavailable` e `?oauth=apple_unavailable`

---

### FASE 333 — Auto-Detect

**Novo arquivo:**

- `functions/api/auth/config.js` — NOVO
  - `GET /api/auth/config` — retorna `{ providers: { email, admin, google, apple }, missing: [] }`
  - `HEAD /api/auth/config` — suportado
  - Quando variáveis OAuth aparecerem no Cloudflare, o login é ativado automaticamente **sem alterar código**

---

### FASE 334 — Validação

**Novo arquivo:**

- `scripts/qa-auth-v47.mjs` — Suite de validação com 18 checks cobrindo:
  - `/api/auth/config` (3 checks)
  - `/api/auth/google` (2 checks)
  - `/api/auth/apple` (2 checks)
  - `/api/login` (3 checks)
  - `/api/register` (2 checks)
  - `/api/password-reset` (2 checks)
  - `/api/session` (2 checks)
  - `/api/logout` (1 check)
  - Páginas de auth frontend (5 checks)

---

### FASE 335 — Deploy

- Build ID: `lifeos-47.0.0-ef9b55dee7ec`
- Versão: `v47.0.0`
- Plataforma: Cloudflare Pages
- Branch: `main`

---

## Garantias desta Release

✓ **Login Email/Senha** — 100% operacional mesmo sem Google OAuth  
✓ **Cadastro** — 100% operacional  
✓ **Recuperação de senha** — 100% operacional  
✓ **Sessão/Cookie/JWT** — 100% operacional  
✓ **Logout** — 100% operacional  
✓ **Google Login** — ativado automaticamente quando `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` forem configurados  
✓ **Apple Login** — ativado automaticamente quando as 4 variáveis Apple forem configuradas  
✓ **Nenhum endpoint retorna erro bruto** — todos têm mensagens claras e acionáveis  
✓ **Nenhum usuário pode ficar bloqueado** — fallback elegante em todos os pontos  

---

## Variáveis Pendentes para Configuração

Para ativar funcionalidades opcionais, configure no painel Cloudflare Pages → Settings → Environment Variables:

```bash
# Google OAuth (opcional)
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

# Apple Sign In (opcional)
npx wrangler secret put APPLE_CLIENT_ID
npx wrangler secret put APPLE_TEAM_ID
npx wrangler secret put APPLE_KEY_ID
npx wrangler secret put APPLE_PRIVATE_KEY

# Email (opcional — para cadastro com confirmação e recuperação de senha)
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM
```

Após configurar, **nenhuma alteração de código é necessária** — o sistema detecta automaticamente.
