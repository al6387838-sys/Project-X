# LifeOS Enterprise — Documentação Técnica

## 1. Arquitetura

O LifeOS Enterprise utiliza uma arquitetura de múltiplas páginas (Multi-Page Application - MPA) com renderização no servidor via Cloudflare Pages Functions, garantindo alta performance, SEO otimizado e baixa latência global.

### Componentes Principais
- **Frontend**: HTML5, CSS3 (Enterprise Design System), JavaScript ES6+ (Vanilla)
- **Backend**: Cloudflare Pages Functions (Node.js compatible)
- **Database**: Cloudflare KV (Key-Value) para sessões e cache, Cloudflare R2 para arquivos e documentos
- **Auth**: OAuth 2.0 (Google, Apple, Microsoft), Passkeys, Email/Password
- **Integrações**: Microsoft Graph API, Resend API (Email), WhatsApp Cloud API

## 2. APIs Implementadas

A plataforma expõe uma vasta superfície de APIs RESTful através do diretório `functions/api/`:

| Categoria | Endpoints Principais |
|-----------|----------------------|
| **Autenticação** | `/api/login`, `/api/logout`, `/api/register`, `/api/session`, `/api/profile` |
| **Microsoft Ecosystem** | `/api/microsoft/graph-client` (Mail, Calendar, OneDrive, Teams) |
| **Finance** | `/api/finance/hub`, `/api/finance/transactions` |
| **Documents** | `/api/documents`, `/api/document-workflow-r2` |
| **Enterprise** | `/api/enterprise/rbac`, `/api/enterprise/certification`, `/api/enterprise/invite` |
| **System** | `/api/health`, `/api/observability`, `/api/security-audit` |

## 3. Integrações Concluídas

- ✅ **Microsoft Graph API**: Integração completa com Outlook Mail, Calendar, OneDrive e Teams.
- ✅ **Resend API**: Envio de emails transacionais (confirmação de cadastro, recuperação de senha).
- ✅ **Cloudflare R2**: Armazenamento de arquivos no File Center e Document Workflow.
- ✅ **Cloudflare KV**: Gerenciamento de sessões e cache de alta performance.

## 4. Integrações Aguardando Credenciais

- ⏳ **WhatsApp Cloud API**: Módulo implementado, aguardando `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_ID` e `WHATSAPP_APP_ID`.
- ⏳ **Apple Sign In**: Módulo implementado, aguardando `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID` e `APPLE_PRIVATE_KEY`.
- ⏳ **SendGrid**: Provedor alternativo de email, aguardando `SENDGRID_API_KEY`.

## 5. Variáveis de Ambiente Necessárias

### Produção (Cloudflare Pages Secrets)
- `LIFEOS_SESSION_SECRET`: Segredo para criptografia de sessões.
- `LIFEOS_ADMIN_PASSWORD_HASH`: Hash da senha do administrador master.
- `RESEND_API_KEY`: Chave da API para envio de emails.
- `EMAIL_FROM`: Endereço de remetente (ex: "LifeOS <noreply@lifeos.app>").
- `WHATSAPP_ACCESS_TOKEN`: Token de acesso do WhatsApp Business.
- `WHATSAPP_PHONE_ID`: ID do número de telefone no WhatsApp.
- `WHATSAPP_APP_ID`: ID do aplicativo no Meta Developers.
- `WHATSAPP_APP_SECRET`: Segredo do aplicativo do WhatsApp.
- `WHATSAPP_VERIFY_TOKEN`: Token de verificação de webhooks do WhatsApp.
- `APPLE_CLIENT_ID`: ID do cliente para Apple Sign In.
- `APPLE_TEAM_ID`: ID da equipe Apple.
- `APPLE_KEY_ID`: ID da chave Apple.
- `APPLE_PRIVATE_KEY`: Chave privada Apple.
- `SENDGRID_API_KEY`: Chave da API SendGrid (alternativa ao Resend).

## 6. Fluxos Enterprise

- **Onboarding**: Fluxo guiado para novos usuários e organizações.
- **RBAC (Role-Based Access Control)**: Gerenciamento granular de permissões para membros da organização.
- **Billing & Compliance**: Rastreamento de uso e conformidade com políticas organizacionais.
- **Audit Trail**: Registro completo de todas as ações críticas no sistema.

## 7. Manuais

### Manual de Implantação (Deploy)
Para implantar o LifeOS Enterprise em produção:
1. Clone o repositório e instale as dependências (`npm install`).
2. Configure as variáveis de ambiente no Cloudflare Pages.
3. Execute o build limpo: `npm run build:clean`.
4. Faça o deploy via Wrangler: `npm run deploy:cf`.

### Manual de Administração
- Acesse o painel admin em `/admin`.
- Gerencie membros via `/api/enterprise/members`.
- Configure permissões RBAC via `/api/enterprise/rbac`.
- Monitore a saúde do sistema via `/api/health` e `/api/observability`.

### Manual de Onboarding
- Novos usuários passam por um fluxo guiado de setup inicial.
- Administradores podem enviar convites via `/api/enterprise/invite`.
- O sistema valida permissões e roles automaticamente durante o login.

## 8. Checklist Go-Live

- [x] Build de produção certificado (452/452 checks)
- [x] Integrações reais validadas (Email, Auth, KV, R2)
- [x] Bugs gráficos críticos corrigidos (Ícones, Fallbacks)
- [x] Compatibilidade mobile/iOS garantida
- [x] Service Worker limpo e sem registros legados
- [x] Versões sincronizadas (GitHub, Cloudflare, Manifesto)
- [ ] Credenciais do WhatsApp configuradas (Aguardando Chave)
- [ ] Credenciais da Apple configuradas (Aguardando Chave)
