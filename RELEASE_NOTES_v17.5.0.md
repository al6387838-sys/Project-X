# LIFEOS ENTERPRISE v17.5.0 — Release Notes

**Release:** v17.5.0  
**Canal:** produção  
**Plataforma:** Cloudflare Pages + Cloudflare KV  
**Fases:** 163–171

## Visão geral

A versão 17.5.0 conclui o ciclo Enterprise iniciado pelas auditorias das Phases 163–166 e entrega as Phases 167–171 sem substituir o shell, a navegação, o Design System ou a arquitetura Cloudflare existente. A evolução concentra-se na gestão persistente de workspaces, na operação verificável de integrações, na central unificada de notificações e na remoção de métricas, tendências e conteúdos que não possuíam fonte de dados observável.

| Área | Entrega da v17.5.0 |
|---|---|
| Design System | Auditoria de consistência visual, densidade, foco, responsividade e estados de interface |
| Experiência de dados | Estados vazios contextuais e eliminação de métricas ou tendências não sustentadas |
| Workspaces | Visão interna com overview, membros, atividades, preferências e exclusão protegida |
| Integrações | Status verificável, configuração persistente, permissões granulares, histórico e reconexão administrativa |
| Notificações | Central por categorias, filtros, preferências persistentes, leitura individual e badges sincronizados |
| Qualidade | Gate de produção ampliado para bloquear conteúdo provisório e telemetria estimada no Enterprise |

## Workspaces corporativos

A área de Workspaces agora permite abrir cada workspace e gerenciar sua visão geral, membros, atividade recente e preferências. Alterações são persistidas no mesmo contrato Enterprise e no binding KV já existente. A exclusão exige confirmação explícita, não permite a remoção de workspaces protegidos e registra os eventos correspondentes na auditoria e nas notificações habilitadas.

## Central de Integrações

A vitrine anterior foi substituída por uma central operacional. Uma integração somente aparece como configurada quando existem dados persistidos; conta, permissões e histórico podem ser revisados no próprio LIFEOS. A reconexão é uma ação administrativa interna e o produto declara expressamente que nenhuma sincronização externa é executada sem credenciais e fluxo de autorização do provedor. Segredos não são solicitados nem exibidos na interface.

## Central de Notificações

As notificações são produzidas por mutações reais concluídas no Enterprise e respeitam as preferências por categoria. A interface oferece filtros, leitura individual, marcação coletiva, preferências persistentes e indicadores sincronizados no menu lateral e no topo. Seeds demonstrativos legados foram removidos e o estado vazio explica quando nenhum evento operacional está disponível.

## Confiabilidade dos dados

Métricas aleatórias de CPU, memória, uptime, latência e sessões foram removidas. Enquanto não houver fonte de telemetria configurada, a interface informa **indisponível** ou **não monitorada**. O Analytics Executivo mantém apenas totais derivados do estado persistido e substitui o gráfico estático de crescimento por um estado vazio que informa a ausência de snapshots temporais.

## Qualidade da release

| Verificação | Resultado |
|---|---:|
| Gate de produção | **267/267** |
| Responsividade | **60/60** |
| Funcional Enterprise | **17/17** |
| Regressão v11 | **8/8** |
| Erros JavaScript na regressão autenticada | **0** |
| Respostas HTTP 4xx/5xx na regressão autenticada | **0** |
| Build e verificação de diferenças | **Aprovados** |

## Limites operacionais externos

A release não inventa conexões com provedores. Sincronização efetiva com Google Workspace, Slack, Stripe ou outros serviços continua condicionada à configuração de credenciais, consentimentos, callbacks e webhooks correspondentes. Métricas de infraestrutura dependem de uma fonte de telemetria real. Essas dependências externas não alteram o funcionamento interno persistente entregue nesta versão.

> A v17.5.0 promove a experiência Enterprise a um estado operacional verificável, mantendo a arquitetura Cloudflare existente e distinguindo claramente dados persistidos, integrações configuradas e capacidades externas ainda não conectadas.
