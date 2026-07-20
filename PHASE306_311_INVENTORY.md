# LIFEOS ENTERPRISE — FASES 306-311 INVENTORY

## v44.0.0 — Build OK, 37 módulos, 46 endpoints API

### BOTÕES MORTOS (páginas da sidebar sem div correspondente):
- ai-daily, ai-weekly, ai-recommendations
- messages, email, calendar
- kanban, gantt, crm, wiki
- documents, ai-center, marketplace
- app-ecosystem, integration-center
- personal-hub, observability
- command-center, identity
- file-center, automation, analytics

### AÇÕES CORRETIVAS NECESSÁRIAS:

1. **Botão "Novo Hábito"** (linha 1287) — sem onclick, botão morto
   → Adicionar onclick="openNewHabitModal()"

2. **finance.html** — Valores hardcoded (R$ 24.850,00, contas bancárias fake)
   → Remover hardcoded, usar fetch da API

3. **dashboard-v2.html** — Agenda hardcoded
   → Carregar via fetch /api/dashboard

4. **Modais existentes** — Usam prompt() + fetch API (já funcionais para goals, projects, notes, timeline events)

5. **openNewHabitModal()** — Apenas faz showPage('habits'), não cria hábito
   → Implementar criação via fetch /api/habits

6. **Páginas faltantes** — 22 páginas referenciadas na sidebar não existem no HTML
   → Criar containers dinâmicos que carregam módulos via fetch

### APIs já funcionais (KV real):
- /api/dashboard, /api/tasks, /api/habits, /api/goals
- /api/finance/hub, /api/documents
- /api/ai/orchestrator, /api/security
- /api/payments, /api/collaboration
- /api/auth/google, /api/auth/apple
- /api/login, /api/logout, /api/register
- /api/session, /api/profile, /api/settings
- /api/notifications, /api/workspaces
- /api/observability, /api/health
- /api/integrations, /api/operation-audit
- /api/enterprise/rbac, /api/enterprise/certification
- /api/enterprise/invite, /api/enterprise/members
- /api/enterprise/config-center, /api/enterprise/onboarding
- /api/enterprise-data, /api/crm
- /api/automations, /api/comm-hub
- /api/analytics-pro, /api/db-optimize
- /api/security-audit, /api/admin-data

### R2 NOT CONFIGURADO no wrangler.toml
- documents API referencia env.LIFEOS_R2 / env.LIFEOS_FILES / env.R2_BUCKET
- Nenhum binding R2 no wrangler.toml
