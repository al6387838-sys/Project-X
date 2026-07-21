# LifeOS Enterprise v46.0.0 — Guia de Deploy Imediato

## Status: PRONTO PARA PRODUÇÃO

O repositório está 100% preparado para deploy. Nenhuma alteração adicional de código é necessária após a configuração da infraestrutura Cloudflare.

---

## Pré-requisitos

| Item | Status | Obs |
|------|--------|-----|
| Node.js 18+ | Necessário | Instalar via nvm |
| Wrangler CLI | Necessário | `npm install -g wrangler` |
| Conta Cloudflare | Necessário | Com acesso ao Cloudflare Pages, R2 e KV |
| Stripe Account | Necessário | Para billing e subscrições |
| Google Cloud Console | Necessário | Para OAuth 2.0 |
| Apple Developer Account | Necessário | Para Sign In with Apple |
| WhatsApp Business API | Opcional | Para notificações WhatsApp |
| SendGrid (ou SMTP) | Necessário | Para envio de e-mails |
| OpenAI API Key | Necessário | Para IA Orchestration |

---

## Passo a Passo de Deploy (5 minutos)

### 1. Autenticar no Cloudflare

```bash
npx wrangler login
```

### 2. Criar KV Namespace

```bash
npx wrangler kv:namespace create LIFEOS_KV
# Copie o ID retornado e atualize o wrangler.toml
```

### 3. Criar R2 Buckets

```bash
npx wrangler r2 bucket create lifeos-files
npx wrangler r2 bucket create lifeos-documents
npx wrangler r2 bucket create lifeos-storage
```

### 4. Configurar Secrets

```bash
npx wrangler secret put LIFEOS_SESSION_SECRET
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put APPLE_PRIVATE_KEY
npx wrangler secret put SMTP_PASSWORD
npx wrangler secret put WHATSAPP_API_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put CLOUDFLARE_TURNSTILE_SECRET_KEY
```

### 5. Build e Deploy

```bash
npm run build
npm run deploy
```

### 6. Verificar

```bash
npm run test:production
```

---

## Estrutura de Deploy

```
Cloudflare Pages
├── Rotas: 73 endpoints
├── API Endpoints: 48 rotas
├── Módulos: 37 módulos lazy-loaded
├── KV Namespace: LIFEOS_KV
├── R2 Buckets: 3 (files, documents, storage)
└── Secrets: 9 variáveis secretas
```

---

## URLs de Produção

| Serviço | URL |
|---------|-----|
| Landing Page | https://lifeos-enterprise.pages.dev |
| Aplicação | https://lifeos-enterprise.pages.dev/app |
| Admin Panel | https://lifeos-enterprise.pages.dev/admin |
| Enterprise | https://lifeos-enterprise.pages.dev/enterprise |

---

## Rollback

```bash
npx wrangler pages deployment list --project-name lifeos-enterprise
npx wrangler pages deployment rollback --project-name lifeos-enterprise --deployment-id <ID>
```

---

## Cache Invalidation (se necessário)

```bash
npx wrangler pages project purge --project-name lifeos-enterprise
```
