# Changelog

Todas as alterações notáveis no LifeOS Enterprise serão documentadas neste arquivo.

## [57.0.0] — 2026-07-25

### Release: LIFEOS ENTERPRISE v57.0.0 — Go Live Fix Absoluto

Esta release foca na correção de bugs críticos para o Go Live absoluto, garantindo que todas as integrações reais (Email, Auth, KV, R2) estejam funcionando perfeitamente sem mocks.

### Correções Críticas
- **Sistema de Email (REAL)**: Integração Resend API funcionando com envio real de emails. Confirmação de cadastro e recuperação de senha operacionais.
- **Bugs Gráficos Eliminados**: Círculos fantasmas corrigidos no `icon-svg-renderer.js` (659 ícones embutidos). Fallback SVG corrigido para transparente. Ícones de menu, Wiki, Marketplace e Fluxo de Caixa corrigidos.
- **Compatibilidade Safari/iOS**: Adicionado `-webkit-backdrop-filter` em todos os CSS. Fix de viewport iOS Safari e suporte a `100dvh`.

### Build System
- **Certificação de Build**: 452/452 checks passed no `verify-production.mjs`.
- **Integridade de Versão**: Garantia de que todas as camadas (manifesto, health, metadata) refletem exatamente a mesma versão e commit.

## [56.1.0] — 2026-07-25

### Release: File Center Enterprise Module

- **File Center**: Módulo Enterprise completo com CRUD, preview, lixeira, favoritos e metadados reais via Cloudflare R2.

## [56.0.0] — 2026-07-25

### Release: Enterprise Certification Final

- **Enterprise Certification**: Certificação final de todos os módulos enterprise, garantindo conformidade com padrões de segurança e performance.

## [51.0.0] — 2026-07-28

### Release: LIFEOS ENTERPRISE v51.0.0 — Phase 751 (Microsoft Ecosystem Enterprise Integration)

Esta release introduz a integração completa com o Microsoft Ecosystem via Microsoft Graph API, incluindo Outlook Mail, Outlook Calendar, OneDrive e Microsoft Teams.

### Integrações
- **Microsoft Graph API Client**: Módulo unificado com 4 sub-módulos (MAIL, CALENDAR, ONEDRIVE, TEAMS).
- **Outlook Mail**: Inbox, sent, drafts, trash, favorites, search, read, reply, forward, attachments, send.
- **Outlook Calendar**: Eventos, convites, aceitar, recusar, reagendar, sync bidirecional.
- **OneDrive**: Upload, download, pastas, compartilhamento, favoritos, pesquisa, permissões.
- **Microsoft Teams**: Equipes, canais, mensagens, compartilhamento, arquivos, tabs.
