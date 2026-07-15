# LifeOS Enterprise — Changelog

## [9.6.0] — 2026-07-15

### Added
- **Phase 088 — Life Dashboard 2.0**: Dashboard recriado como centro de comando com widgets configuráveis
  - 10 widgets: Resumo do Dia, Agenda, Compromissos, Metas, Hábitos, Life Score, Finance Hub, Comunicação, IA Companion, Atividades Recentes
  - Sistema drag-and-drop para reorganização de widgets
  - Persistência de layout via localStorage
  - Toggle para ativar/desativar cada widget
  - Loader dinâmico com fetch do módulo

- **Phase 089 — Smart Search Global**: Busca unificada inteligente em todos os módulos
  - Busca em 8 categorias: Usuários, Organizações, Workspaces, Documentos, Tarefas, Notificações, Módulos, Configurações
  - Filtros por tipo de conteúdo
  - Navegação por teclado (↑↓ Enter Esc)
  - Buscas recentes com persistência localStorage
  - Highlight de termos pesquisados
  - Stats de resultados por categoria

- **Phase 090 — Enterprise Notification Center**: Central de notificações com tempo real
  - Abas: Todas, Não lidas, Por categoria, Histórico
  - Filtros por prioridade (Crítica, Alta, Média, Baixa) e categoria (Sistema, Produtividade, Financeiro, Social, Segurança)
  - Stats em tempo real: total, não lidas, críticas, hoje
  - Ações: marcar lida, remover, marcar todas lidas, limpar histórico
  - Simulação de notificação em tempo real (toast após 10s)
  - 15 notificações de exemplo cobrindo todos os cenários

### Changed
- Substituição do dashboard antigo (hábitos/metas/timeline hardcoded) pelo Dashboard 2.0 dinâmico
- Substituição da busca básica pelo Smart Search global
- Substituição das notificações estáticas pelo Notification Center
- Build script atualizado para v9.6.0 com 15 módulos
- Package.json atualizado para v9.6.0

### Fixed (Phase 091 — QA)
- Removido conteúdo órfão do dashboard antigo
- Corrigidas referências quebradas de `dash-greeting` e `dash-date`
- Removida função `doSearch` obsoleta
- Adicionados loaders lazy para todos os novos módulos
- Validados todos os 15 módulos no dist
- Validadas rotas legadas no _redirects
- Patch de URLs Netlify legadas mantido
