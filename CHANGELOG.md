# Changelog

All notable changes to LifeOS will be documented in this file.

## [17.5.0] — 2026-07-16

### Release: LIFEOS ENTERPRISE v17.5.0 — Phases 163–171

A v17.5 conclui as auditorias de experiência Enterprise e entrega gestão persistente de Workspaces, uma Central de Integrações com estados verificáveis, permissões e histórico, e uma Central unificada de Notificações alimentada por eventos operacionais reais. Métricas aleatórias, tendências sem série histórica e conexões externas simuladas foram removidas ou substituídas por estados explícitos de indisponibilidade.

| Controle | Resultado |
|---|---:|
| Gate de produção | 267 / 267 |
| QA responsivo | 60 / 60 |
| QA funcional | 17 / 17 |
| Regressão v11 | 8 / 8 |
| Erros JavaScript autenticados | 0 |
| Respostas HTTP 4xx/5xx autenticadas | 0 |

Os detalhes completos estão em [`RELEASE_NOTES_v17.5.0.md`](RELEASE_NOTES_v17.5.0.md), a auditoria consolidada em [`audit/phase-166-visual-data-audit.md`](audit/phase-166-visual-data-audit.md) e o estado retomável em [`CHECKPOINT_v17_5_0.md`](CHECKPOINT_v17_5_0.md).

---

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [10.0.0-rc.1] — 2026-07-15

### Release: LifeOS Enterprise v10.0.0-rc.1 — Phases 093–100

A release candidate v10 evolui o dashboard para **Command Center com 12 widgets**, expande a **Busca Universal**, adiciona uma **Central de Integrações com 9 conectores**, transforma o AI Center em **Companion AI com Memory Center** e amplia o **Enterprise Admin** com gestão operacional de usuários e tenants.

| Controle | Resultado |
|---|---:|
| Build de produção | Aprovado |
| QA responsivo | 60 / 60 |
| QA funcional | 17 / 17 |
| Regressão v10 | 9 / 9 |
| Vulnerabilidades npm | 0 |

O hardening inclui composição segura de mensagens, caminhos modulares determinísticos, visibilidade exclusiva do módulo ativo, handlers administrativos independentes do objeto global `event` e correção da persistência de widgets removidos. Os detalhes completos estão em [`CHANGELOG_v10.md`](CHANGELOG_v10.md) e o estado de continuidade em [`CHECKPOINT_v10.0.0-rc.1.md`](CHECKPOINT_v10.0.0-rc.1.md).

---

## [9.6.0] — 2026-07-15

### Release: LIFEOS ENTERPRISE v9.6.0 — Phases 088–092

#### Phase 088 — Life Dashboard 2.0
- **Centro de Comando**: Dashboard recriado como hub central com widgets configuráveis
- **10 Widgets**: Resumo do Dia, Agenda, Compromissos, Metas, Hábitos, Life Score, Finance Hub, Comunicação, IA Companion, Atividades Recentes
- **Drag-and-Drop**: Sistema para reorganizar widgets livremente
- **Persistência**: Layout salvo automaticamente no localStorage
- **Toggle**: Ativar/desativar cada widget individualmente
- **Loader Dinâmico**: Carregamento assíncrono do módulo dashboard-v2.html

#### Phase 089 — Smart Search Global
- **Busca Unificada**: Indexação de 8 categorias (Usuários, Organizações, Workspaces, Documentos, Tarefas, Notificações, Módulos, Configurações)
- **Filtros Inteligentes**: Filtro por tipo de conteúdo com contadores dinâmicos
- **Navegação por Teclado**: ↑↓ para navegar, Enter para abrir, Esc para fechar
- **Buscas Recentes**: Persistência no localStorage com até 8 termos
- **Highlight**: Destaque visual dos termos pesquisados nos resultados
- **Stats**: Contagem de resultados por categoria em tempo real
- **Loader Dinâmico**: Carregamento lazy quando a página de busca é aberta

#### Phase 090 — Enterprise Notification Center
- **Abas**: Todas, Não lidas, Por categoria, Histórico
- **Filtros**: Prioridade (Crítica, Alta, Média, Baixa) e Categoria (Sistema, Produtividade, Financeiro, Social, Segurança)
- **Stats em Tempo Real**: Total, não lidas, críticas, hoje
- **Ações**: Marcar lida, remover, marcar todas lidas, limpar histórico
- **Tempo Real**: Simulação de notificação em tempo real com toast após 10s
- **15 Notificações**: Cobrindo todos os cenários (system, productivity, finance, social, security)
- **Loader Dinâmico**: Carregamento lazy quando a página de notificações é aberta

#### Phase 091 — Stability + QA
- Removido conteúdo órfão do dashboard antigo (hábitos/metas/timeline hardcoded)
- Corrigidas referências quebradas (dash-greeting, dash-date → d2-greeting, d2-date)
- Removida função doSearch obsoleta substituída pelo Smart Search
- Adicionados loaders lazy para Dashboard 2.0, Smart Search e Notification Center
- Validados todos os 15 módulos no dist
- Validadas rotas legadas no _redirects
- Patch de URLs Netlify legadas mantido

#### Phase 092 — Production Release
- **Version**: 9.6.0
- **Modules**: 15 (8 legacy + 4 v9.5 + 3 v9.6)
- **Build Size**: 2.0 MB
- **Routes**: 17 rotas
- **Design System**: enterprise_v9_5.css mantido

---

## [9.5.0] — 2026-07-15

### Release: LIFEOS ENTERPRISE v9.5.0 — Phases 081–087

#### Phase 081 — App Ecosystem
- **App Registry**: catálogo completo de todos os apps instalados com status, versão e dependências
- **Module Marketplace**: loja de módulos com categorias, avaliações, instalação e preview
- **Dependency Manager**: mapa visual de dependências entre módulos com detecção de conflitos
- **Version Manager**: controle de versões com histórico, rollback e changelog por módulo
- **Integration Catalog**: catálogo de integrações externas (OAuth, API Key, Webhook) com status em tempo real

#### Phase 082 — Personal Digital Hub
- **Central Financeira**: visão consolidada de contas, investimentos, gastos e metas financeiras
- **Central de Comunicação**: inbox unificado de mensagens, e-mails e notificações
- **Central de Documentos**: gerenciador de arquivos com busca, tags e preview
- **Central de Agenda**: calendário integrado com eventos, lembretes e sincronização
- **Central de IA**: acesso rápido a todos os recursos de inteligência artificial
- **Central de Produtividade**: kanban, gantt, projetos e metas em um único hub

#### Phase 083 — Enterprise Settings
- **Preferências Gerais**: configurações de comportamento, notificações e acessibilidade
- **Idioma & Região**: seleção de idioma, fuso horário, formato de data e moeda
- **Tema & Aparência**: dark/light mode, cores de destaque, densidade e tipografia
- **Integrações**: gerenciamento de todas as integrações externas ativas
- **Segurança**: 2FA, política de senhas, logs de acesso e alertas de segurança
- **Sessões Ativas**: visualização e revogação de sessões por dispositivo
- **Dispositivos**: gerenciamento de dispositivos confiáveis
- **API Keys**: criação, rotação e revogação de chaves de API
- **Webhooks**: configuração de endpoints com logs de entrega e retry

#### Phase 084 — Observability Enterprise
- **Health Dashboard**: status em tempo real de todos os 8 serviços com uptime (30 dias)
- **Métricas**: requisições/min, latência P95, taxa de erro, usuários ativos, CPU, memória
- **Logs**: stream de logs com filtros por nível (INFO/WARN/ERROR/DEBUG) e busca full-text
- **Alertas**: sistema de alertas com severidade, reconhecimento e resolução
- **Performance**: latência por endpoint e utilização de recursos do sistema

#### Phase 085 — Product Polish
- **Design System v9.5**: tokens expandidos, shadows premium, glassmorphism, transitions spring
- **Cards Enterprise**: hover effects, gradientes, before/after decorativos
- **Grids Responsivos**: sistema de grid completo com breakpoints automáticos
- **Forms Enterprise**: estados de foco, erro, sucesso com acessibilidade
- **Animations Premium**: fadeIn, slideUp, scaleIn, bounceIn, stagger children
- **Loading States**: skeleton shimmer, spinner, progress bar animado
- **Buttons v9.5**: primary, secondary, ghost, danger com ripple effect
- **Sidebar v9.5**: collapsed mode, active indicator, badge counter

#### Phase 086 — QA Final
- Build script atualizado para v9.5.0
- Validação de todos os 12 módulos no dist
- Todos os assets validados com sucesso

#### Phase 087 — Production Release
- **Version**: 9.5.0
- **Build ID**: lifeos-v9.5.0-ce78f692fed1
- **Platform**: Cloudflare Pages
- **Modules**: 12 (8 legacy + 4 novos)
- **Design System**: enterprise_v9_5.css

---

## [8.0.0] — 2026-07-15

### Added

- Publicação das rotas públicas `/register`, `robots.txt` e `sitemap.xml` no pipeline oficial do Cloudflare Pages.
- Metatags completas para indexação, compartilhamento social, idioma e URL canônica da landing page.

### Changed

- Otimização final da landing page para Performance, Accessibility, Best Practices e SEO.
- Testes funcionais e responsivos alinhados exclusivamente à prévia e aos endpoints Cloudflare.
- Pipeline de build atualizado para validar também cadastro e artefatos públicos de SEO.

### Fixed

- Contrastes de texto reprovados na auditoria de acessibilidade.
- Erro de console causado pela consulta opcional de sessão na landing pública.
- Controlador Enterprise legado incompatível removido, preservando o controlador completo incorporado à página.
- Referências residuais de QA a endpoints Netlify substituídas por `/api/*` do Cloudflare.

### Quality

- Lighthouse final: Performance 97, Accessibility 100, Best Practices 100 e SEO 100.

## [1.0.0-rc]
### Added
- **Extensibility Platform:** Conclusão da fase EXECUTION-008, validando a arquitetura do Connector Engine, Marketplace, OAuth System e SDK inicial.
 - 2026-07-09

### Added
- **Observability Stack:** Integrated Prometheus, Grafana, and Loki for comprehensive system monitoring.
- **Alert Manager:** Automated rule-based alerting for high error rates, latency spikes, and security threats.
- **Advanced Test Suite:** Added 28 new rigorous tests covering Stress, Security, Recovery, Performance, and Offline capabilities.
- **Deployment Scripts:** Automated bash scripts for Staging and Production deployments, including automated backups and rollback functionality.
- **Production Dockerfile:** Multi-stage, security-hardened Dockerfile running as a non-root user.
- **Documentation:** Comprehensive official documentation (README, INSTALL, DEPLOY, SECURITY, ARCHITECTURE, ROADMAP).

### Fixed
- **Decision Engine Model Mismatch:** Resolved critical schema divergence between `Decision` model and engine expectations, fixing 63 failing tests.
- **Deprecation Warnings:** Eliminated over 1200 `datetime.utcnow()` deprecation warnings across the entire codebase, migrating to `datetime.now(timezone.utc)`.
- **Timezone Bugs:** Fixed `format_relative` in the Globalization Layer to correctly handle naive vs. aware datetimes.
- **Pytest Warnings:** Resolved `PytestReturnNotNoneWarning` and `PytestCollectionWarning` in the Connector Platform test suite.
- **Event Loop Deprecation:** Updated `asyncio.get_event_loop().run_until_complete()` to `asyncio.run()` in test suites.
- **API Mismatches in RC Tests:** Fixed method signatures in `FeedbackEngine`, `AuditManager`, and `ThreatMonitor` to align with actual implementation.

### Changed
- **Test Coverage:** Achieved 100% pass rate (544 tests) with zero failures and zero warnings.
- **Security Models:** Updated default factories in dataclasses to use lambda functions for thread-safe UTC datetime generation.

### Removed
- Dead code and unused imports across `cloud_sync`, `decision_engine`, and `connector_platform`.
