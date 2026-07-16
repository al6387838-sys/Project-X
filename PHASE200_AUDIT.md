# PHASE 200 — Auditoria de Dados Estáticos

## Arquivos no Build com Dados Estáticos

### 1. `premium_ui/app_dashboard.html` → `dist/app/index.html` (ARQUIVO PRINCIPAL DO APP)
- Linha 1336: hábitos hardcoded (Meditação 10min, etc.)
- Linha 1355-1369: metas hardcoded (Correr 100km, Ler 24 livros, Economizar R$10k)
- Linha 1406: insight hardcoded sobre meta
- Linha 1453-1455: timeline de atividades hardcoded
- Linha 1941-1943: searchData hardcoded

### 2. `premium_ui/modules/dashboard-v2.html` → `dist/modules/dashboard-v2.html`
- Hábitos hardcoded (Meditação 10min, Exercício físico, etc.)
- Metas hardcoded (Correr 100km 72%, Ler 24 livros 58%, Economizar R$10k 45%)
- Finance chart com dados hardcoded [40,55,35,70,60,80,65,90,75,85,70,95]

### 3. `premium_ui/modules/life-hub.html` → `dist/modules/life-hub.html`
- Linha 705: `const habitsData` com 9 hábitos hardcoded

### 4. `premium_ui/modules/smart-search.html` → `dist/modules/smart-search.html`
- Dados de busca hardcoded

### 5. `premium_ui/modules/notification-center.html` → `dist/modules/notification-center.html`
- Notificações hardcoded

### 6. `premium_ui/index.html` (NÃO COPIADO NO BUILD - arquivo legado/admin)
- Contém: initTimeline, initBriefing, initMetrics, initLifeGraph com dados estáticos
- Usa /api/admin-session (é o painel admin antigo)
- NÃO é copiado pelo build.mjs como nenhum arquivo de produção

## APIs Reais Criadas na Phase 200
- `/api/timeline` → `functions/api/timeline.js` ✅ CRIADO
- `/api/briefing` → `functions/api/briefing.js` ✅ CRIADO
- `/api/metrics` → `functions/api/metrics.js` ✅ CRIADO
- `/api/life-graph` → `functions/api/life-graph.js` ✅ CRIADO

## APIs Existentes (Phase 139+)
- `/api/tasks` → `functions/api/tasks.js` ✅
- `/api/habits` → `functions/api/habits.js` ✅
- `/api/goals` → `functions/api/goals.js` ✅
- `/api/dashboard` → `functions/api/dashboard.js` ✅
- `/api/user-data` → `functions/api/user-data.js` ✅
- `/api/session` → `functions/api/session.js` ✅

## Estratégia de Migração
1. O arquivo PRINCIPAL do app é `app_dashboard.html` → copiado como `dist/app/index.html`
2. O `premium_ui/index.html` é um arquivo legado (admin) NÃO incluído no build de produção
3. Os módulos (dashboard-v2, life-hub, etc.) são carregados via fetch dentro do app_dashboard
4. A migração deve focar em:
   a. `app_dashboard.html` - substituir dados estáticos por chamadas API
   b. `modules/dashboard-v2.html` - substituir dados estáticos por chamadas API
   c. `modules/life-hub.html` - substituir habitsData por API
   d. `modules/smart-search.html` - substituir searchData por API
   e. `modules/notification-center.html` - substituir notificações por API
   f. Adicionar `premium_ui/index.html` ao build como rota do app (ou migrar para app_dashboard)

## Nota sobre o premium_ui/index.html
O arquivo `premium_ui/index.html` contém as funções initTimeline, initBriefing, initMetrics, initLifeGraph
com dados estáticos. Ele usa /api/admin-session (sessão de admin). 
DECISÃO: Adicionar este arquivo ao build como rota alternativa do app OU migrar suas funções para o app_dashboard.html.
Como o build.mjs usa app_dashboard.html como app principal, a migração deve ser feita neste arquivo.
