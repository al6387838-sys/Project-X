# LIFEOS ENTERPRISE — MAPA DE ERROS (FASE 802)

**Data:** 23 de Julho de 2026
**Versão Base:** v51.0.0
**Status:** Identificação concluída.

A auditoria profunda da FASE 801 revelou problemas de integração entre o arquivo mestre do dashboard (`app_dashboard.html`) e os módulos individuais (carregados dinamicamente). Muitos botões nos módulos tentam chamar funções que não existem no escopo global, e algumas APIs não foram implementadas.

## Tabela de Bugs Identificados

| Nome da tela | Botão / Ação | Erro encontrado | Arquivo responsável | API / Backend | Prioridade |
|--------------|--------------|-----------------|---------------------|---------------|------------|
| **Landing** | FAQ Accordion | Clique falhou via Playwright (DOM) | `landing.html` | Frontend | Baixa |
| **Login API** | POST /api/login | HTTP 401 para demo@lifeos.app | `login.js` | Backend | Baixa |
| **Integrações** | Conectar App | Rota HTTP 405 (Method Not Allowed) | `app_dashboard.html` | `/api/integrations/connect` | **CRÍTICA** |
| **AI Center** | Ações AI | Funções indefinidas (`aiAddAllTasks`, etc) | `ai-center.html` | Frontend | **ALTA** |
| **Analytics** | Exportar/Tabs | Funções indefinidas (`analyticsExport`, etc) | `analytics.html` | Frontend | **ALTA** |
| **Automação** | CRUD Automação | Funções indefinidas (`automationCreate`, etc) | `automation.html` | Frontend | **ALTA** |
| **Calendário** | Navegação/Sync | Funções indefinidas (`calConnect`, etc) | `calendar.html` | Frontend | **ALTA** |
| **Comm Hub** | Navegação | Função indefinida (`showPage`) | `communication-hub.html`| Frontend | Média |
| **Comunicação** | Ações de Mensagem| Funções indefinidas (`msgFilter`, etc) | `communication.html`| `/api/integrations/connect` | **ALTA** |
| **Dashboard v11**| Widgets | Funções indefinidas (`dv11CloseCatalog`, etc) | `dashboard-v11.html` | Frontend | **ALTA** |
| **Documentos** | Ações de Arquivo | Funções indefinidas (`docDeleteViewer`, etc) | `documents.html` | Frontend | **ALTA** |
| **Email** | Ações de Email | Funções indefinidas (`emailCloseCompose`, etc) | `email.html` | Frontend | **ALTA** |
| **File Center** | Upload/Navegação | Funções indefinidas (`fcUpload`, etc) | `file-center.html` | Frontend | **ALTA** |
| **Finance** | Ações Financeiras| Funções indefinidas (`finSwitchTransfer`, etc) | `finance.html` | APIs `/api/finance/*` | **CRÍTICA** |
| **Identity** | Sessões/Perfil | Funções indefinidas (`identityCloseSession`, etc)| `identity.html` | Frontend | **ALTA** |
| **Integrações** | Sync/Logs | Funções indefinidas (`icSync`, etc) | `integration-center.html`| Frontend | **ALTA** |
| **Marketplace** | Instalar App | Funções indefinidas (`mktInstall`, etc) | `marketplace.html` | Frontend | **ALTA** |
| **Fotos** | Álbuns/Upload | Funções indefinidas (`photosOpenAlbum`, etc) | `photos.html` | Frontend | **ALTA** |
| **Produtividade**| Kanban/Wiki | Funções indefinidas (`kanbanOpenNewTask`, etc) | `productivity.html` | Frontend | **ALTA** |

## Causa Raiz

O LifeOS utiliza um modelo de SPA (Single Page Application) onde `app_dashboard.html` carrega os módulos via `fetch()` e injeta o HTML (`innerHTML`). 
Os módulos (`premium_ui/modules/*.html`) possuem botões com `onclick="funcao()"`, mas essas funções não foram declaradas globalmente (`window.funcao = ...`) dentro do módulo ou não existem no `app_dashboard.html`.
Além disso, algumas rotas de API como `/api/integrations/connect` e `/api/finance/*` estão sendo chamadas diretamente, mas não foram mapeadas corretamente no backend do Cloudflare Pages (`functions/api/...`).

## Plano de Correção (FASE 803)

1. **Correção Global de Funções:** Mover todas as funções necessárias dos módulos para o `app_dashboard.html` ou criar um script unificado (`modules_controller.js`) injetado no dashboard.
2. **Correção de APIs (Backend):**
   - Criar `functions/api/integrations/connect.js` que delega para `integrations.js`.
   - Criar `functions/api/integrations/sync.js`.
   - Criar os endpoints faltantes em `functions/api/finance/`.
3. **Validação do Roteador:** Garantir que todas as chamadas a `showPage`, `openModal` e `closeModal` funcionem corretamente de dentro dos módulos.
