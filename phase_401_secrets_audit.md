# Fase 401 — Auditoria de Cloudflare Secrets

## Resumo das Variáveis de Ambiente

### ✅ Variáveis CRÍTICAS (Obrigatórias para produção)

| Variável | Status | Consumo | Onde |
|---|---|---|---|
| `LIFEOS_SESSION_SECRET` | ✅ Consumida | 20+ arquivos | Autenticação JWT em todas as APIs |
| `LIFEOS_ADMIN_PASSWORD_HASH` | ✅ Consumida | login.js, admin-login.js, auth/config.js | Login admin |
| `LIFEOS_KV` | ✅ Binding R2 | 50+ arquivos | Banco de dados principal |

### ✅ Variáveis OBRIGATÓRIAS (Cloudflare Pages)

| Variável | Status | Consumo | Onde |
|---|---|---|---|
| `LIFEOS_R2` | ✅ Binding R2 | documents.js, photos.js, admin-data.js | Bucket `lifeos-files` |
| `LIFEOS_FILES` | ✅ Binding R2 | documents.js, photos.js | Bucket `lifeos-documents` |
| `R2_BUCKET` | ✅ Binding R2 | documents.js, photos.js, config-center.js | Bucket `lifeos-storage` |
| `LIFEOS_ADMIN_USER` | ✅ Declarada em wrangler.toml | login.js, admin-login.js | Email admin |
| `LIFEOS_VERSION` | ✅ Declarada em wrangler.toml | Build metadata | Version tracking |
| `LIFEOS_ENV` | ✅ Declarada em wrangler.toml | Config | Environment flag |

### ✅ Variáveis OPCIONAIS (Consumidas corretamente)

| Variável | Status | Consumo | Onde |
|---|---|---|---|
| `GOOGLE_CLIENT_ID` | ✅ Consumida | google.js, google/callback.js, comm-hub.js | OAuth Gmail |
| `GOOGLE_CLIENT_SECRET` | ✅ Consumida | google.js, google/callback.js | OAuth Gmail |
| `APPLE_CLIENT_ID` | ✅ Consumida | apple.js, auth/config.js | Apple Sign In |
| `APPLE_TEAM_ID` | ✅ Consumida | apple.js, auth/config.js | Apple Sign In |
| `APPLE_KEY_ID` | ✅ Consumida | apple.js, auth/config.js | Apple Sign In |
| `APPLE_PRIVATE_KEY` | ✅ Consumida | apple.js, auth/config.js | Apple Sign In |
| `RESEND_API_KEY` | ✅ Consumida | _email.js, auth/config.js | Email transactional |
| `EMAIL_FROM` | ✅ Consumida | _email.js | Remetente email |
| `SENDGRID_API_KEY` | ✅ Consumida (alternativo) | _email.js | Email alternativo |
| `STRIPE_SECRET_KEY` | ✅ Consumida | payments/billing.js, integrations.js | Pagamentos |
| `STRIPE_WEBHOOK_SECRET` | ✅ Consumida | payments/webhook.js | Webhooks Stripe |
| `STRIPE_PUBLIC_KEY` | ✅ Consumida | billing.js, config-center.js | Pagamentos |
| `OPENAI_API_KEY` | ✅ Consumida | ai/platform.js, config-center.js | IA |
| `OPENAI_MODEL` | ✅ Consumida (opcional) | ai/platform.js | Modelo IA |
| `OPEN_FINANCE_CLIENT_ID` | ✅ Consumida | finance/hub.js | Open Finance |
| `WHATSAPP_APP_ID` | ✅ Consumida | comm-hub.js, communication/hub.js | WhatsApp |
| `WHATSAPP_APP_SECRET` | ✅ Consumida | comm-hub.js, communication/hub.js | WhatsApp token |
| `WHATSAPP_PHONE_ID` | ✅ Consumida | comm-hub.js, communication/hub.js | WhatsApp phone |
| `MICROSOFT_CLIENT_ID` | ✅ Consumida | comm-hub.js, communication/hub.js | Outlook OAuth |
| `MICROSOFT_CLIENT_SECRET` | ✅ Consumida | comm-hub.js | Outlook OAuth |
| `SLACK_BOT_TOKEN` | ✅ Consumida | comm-hub.js | Slack |
| `MERCADO_PAGO_ACCESS_TOKEN` | ✅ Consumida | billing/checkout.js, config-center.js | Mercado Pago |
| `MERCADO_PAGO_PUBLIC_KEY` | ✅ Consumida | integrations.js, config-center.js | Mercado Pago |
| `LIFEOS_WEBHOOK_SECRET` | ✅ Consumida | communication/hub.js | Webhooks |
| `SMTP_HOST/PORT/USER/PASS` | ✅ Consumida | comm-hub.js, automations.js | SMTP |

### ⚠️ Variáveis DUPLICADAS (Mesmo serviço, nomes diferentes)

| Serviço | Nome 1 | Nome 2 | Impacto |
|---|---|---|---|
| Open Finance Brasil | `OPENFINANCE_CLIENT_ID` | `OPEN_FINANCE_CLIENT_ID` | `open-finance.js` usa `OPENFINANCE_`, `hub.js` usa `OPEN_FINANCE_` |
| Open Finance Brasil | `OPENFINANCE_CLIENT_SECRET` | `OPEN_FINANCE_CLIENT_SECRET` | Mesma duplicação |
| Mercado Pago | `MERCADOPAGO_ACCESS_TOKEN` | `MERCADO_PAGO_ACCESS_TOKEN` | `billing/checkout.js` usa `MERCADOPAGO_`, `billing.js` usa `MERCADO_PAGO_` |
| Mercado Pago | `MP_ACCESS_TOKEN` | `MERCADO_PAGO_ACCESS_TOKEN` | `payments/index.js` e `webhook.js` usam `MP_ACCESS_TOKEN` |

### ❌ Variáveis NÃO CONSUMIDAS pelo código (Mortas)

| Variável do Pedido | Status | Observação |
|---|---|---|
| `WHATSAPP_TOKEN` | ❌ Não existe | Nome correto é `WHATSAPP_APP_SECRET` |
| `META_APP_SECRET` | ❌ Não existe | Não é referenciado em nenhum arquivo |
| `APPLE_CLIENT_SECRET` | ⚠️ Referenciado em config-center.js | Não usado no código real (apple.js usa `APPLE_PRIVATE_KEY`) |
| `OPEN_FINANCE_CLIENT_SECRET` | ⚠️ Apenas em mensagem de erro | O código real usa `OPENFINANCE_CLIENT_SECRET` |

### ✅ Variáveis Adicionais (Não no pedido do user, mas necessárias)

| Variável | Consumo |
|---|---|
| `SLACK_SIGNING_SECRET` | comm-hub.js — verificação de webhooks Slack |
| `TEAMS_TENANT_ID` | comm-hub.js — Microsoft Teams |
| `VAPID_PUBLIC_KEY` | integrations.js — Push notifications |
| `VAPID_PRIVATE_KEY` | integrations.js — Push notifications |
| `CLOUDFLARE_ACCOUNT_ID` | integrations.js — R2 externo |
| `CLOUDFLARE_API_TOKEN` | integrations.js — R2 externo |
| `R2_ACCOUNT_ID` | config-center.js — R2 |
| `R2_ACCESS_KEY_ID` | config-center.js — R2 |
| `R2_SECRET_ACCESS_KEY` | config-center.js — R2 |
| `CF_PAGES_COMMIT_SHA` | Build metadata |

---

## Ações de Correção Necessárias

### 1. Eliminar `META_APP_SECRET` (morta)
Não existe no código. Variável morta — não precisa ser configurada.

### 2. Eliminar `WHATSAPP_TOKEN` (morta)
O nome correto é `WHATSAPP_APP_SECRET`. Variável morta — não precisa ser configurada.

### 3. Corrigir duplicação Open Finance
Padronizar para `OPENFINANCE_CLIENT_ID` e `OPENFINANCE_CLIENT_SECRET` (já usado em 5+ arquivos vs 1 em hub.js).

### 4. Corrigir duplicação Mercado Pago
Padronizar para `MERCADO_PAGO_ACCESS_TOKEN` (já usado em 8+ arquivos vs 1 com `MERCADOPAGO_` e 2 com `MP_ACCESS_TOKEN`).

### 5. Adicionar `APPLE_CLIENT_SECRET` ao auth/config.js
Referenciado em config-center.js mas nunca validado no auth/config.js (que só usa `APPLE_PRIVATE_KEY`).

---

## Configuração Cloudflare Pages (wrangler secret put)

### Obrigatórios:
```bash
wrangler secret put LIFEOS_SESSION_SECRET
wrangler secret put LIFEOS_ADMIN_PASSWORD_HASH
```

### Recomendados:
```bash
wrangler secret put RESEND_API_KEY
wrangler secret put EMAIL_FROM
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put APPLE_CLIENT_ID
wrangler secret put APPLE_TEAM_ID
wrangler secret put APPLE_KEY_ID
wrangler secret put APPLE_PRIVATE_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put OPENAI_API_KEY
wrangler secret put OPENFINANCE_CLIENT_ID
wrangler secret put OPENFINANCE_CLIENT_SECRET
wrangler secret put WHATSAPP_APP_ID
wrangler secret put WHATSAPP_APP_SECRET
wrangler secret put WHATSAPP_PHONE_ID
wrangler secret put MERCADO_PAGO_ACCESS_TOKEN
wrangler secret put MERCADO_PAGO_PUBLIC_KEY
```
