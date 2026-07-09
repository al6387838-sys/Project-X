# Mapa do Sistema LifeOS

**Project-X | Sprint 017**

## Introdução

Este documento fornece um mapa detalhado dos componentes internos do LifeOS, incluindo todos os Engines, serviços, fluxos de comunicação e interfaces. O objetivo é oferecer uma visão abrangente de como os diferentes módulos interagem para formar o sistema inteligente que auxilia o usuário em sua vida.

## Engines do LifeOS

O LifeOS é composto por uma série de Engines especializados, cada um com uma função específica. A comunicação entre eles é mediada pelo `Life Kernel`.

| Engine | Responsabilidade Principal | Dependências Chave (via Kernel) | Interfaces Expostas (via Kernel/SDK) |
|---|---|---|---|
| **Life Graph** | Gerenciamento do grafo de conhecimento do usuário. | Context Engine, Memory Engine, Evolution Engine | `get_user_graph`, `update_user_graph` |
| **Memory Engine** | Armazenamento e recuperação de memórias de longo e curto prazo. | Life Graph, Context Engine | `store_memory`, `retrieve_memory` |
| **Context Engine** | Análise e manutenção do contexto atual do usuário. | Life Graph, Memory Engine, Evolution Engine | `get_current_context`, `update_context` |
| **Decision Engine** | Tomada de decisões baseada em dados e objetivos. | Context Engine, Life Graph, Future Engine, Trust Engine | `make_decision`, `get_decision_alternatives` |
| **Action Engine** | Execução de ações e automações. | Decision Engine, Context Engine, Mission Engine | `execute_action`, `plan_action_sequence` |
| **Evolution Engine** | Aprendizado contínuo, análise comportamental e adaptação do sistema. | Life Graph, Context Engine, Memory Engine | `process_feedback`, `update_personal_dna` |
| **Future Engine** | Simulação de cenários, detecção de riscos e oportunidades. | Life Graph, Context Engine, Evolution Engine, Mission Engine | `simulate_future`, `detect_risks`, `detect_opportunities` |
| **Life Orchestrator** | Coordenação de missões, prioridades e dependências. | Mission Engine, Priority Engine, Dependency Engine, Future Engine, Evolution Engine | `create_mission`, `update_mission_status`, `get_mission_progress` |
| **LifeOS Platform SDK** | Interface para aplicativos externos, gerenciamento de plugins. | Permission Manager, LifeOS API (acessa todos os Engines) | `register_plugin`, `invoke_api_method` |
| **Human Experience** | Camada de interface e interação, focada em simplicidade e acessibilidade. | Onboarding Engine, Dashboard Engine, Navigation Engine, Accessibility Manager | `render_ui`, `guide_user` |
| **Trust Engine** | Transparência, auditabilidade e explicabilidade das decisões. | Decision History, Audit Engine, Reasoning Engine, Transparency Engine | `get_decision_explanation`, `audit_trail` |

## Life Kernel: O Centro de Coordenação

O `Life Kernel` é o orquestrador central que permite a comunicação e coordenação entre todos os Engines. Ele é composto por:

*   **Kernel Runtime**: Gerencia o ciclo de vida do Kernel e o loop de processamento de eventos.
*   **Kernel Event Manager**: Barramento de eventos para publicação e subscrição, garantindo comunicação assíncrona e desacoplada.
*   **Kernel State Manager**: Mantém o estado global do sistema, incluindo o status de cada Engine.
*   **Kernel Scheduler**: Agenda eventos e tarefas para execução futura.
*   **Kernel Monitor**: Monitora a saúde do sistema e dos Engines, com capacidades de recuperação.

## Fluxos de Comunicação

A comunicação no LifeOS segue um padrão baseado em eventos, mediado pelo `Kernel Event Manager`:

1.  **Publicação de Eventos**: Um Engine (ou um componente externo via SDK) publica um `KernelEvent` no `Kernel Event Manager`.
2.  **Enfileiramento**: O evento é adicionado à `Event Queue` (que inclui `Priority Queue` e `Execution Queue`) para processamento assíncrono.
3.  **Despacho**: O `Kernel Runtime` extrai eventos da fila e o `Kernel Event Manager` os despacha para todos os Engines subscritos para aquele tipo de evento.
4.  **Processamento**: Os Engines recebem o evento, atualizam seu estado interno e podem, por sua vez, publicar novos eventos.
5.  **Atualização de Estado**: O `Kernel State Manager` é atualizado com o status dos Engines e métricas de eventos, fornecendo uma visão global consistente.

## Interfaces Externas

O LifeOS expõe interfaces para interação com o usuário e com sistemas externos:

*   **User Interface (UI)**: A principal interface de interação para o usuário final, construída sobre a `Human Experience Layer`.
*   **LifeOS SDK**: Um kit de desenvolvimento para que desenvolvedores externos possam criar plugins e integrar suas aplicações. Ele fornece acesso controlado à `LifeOS API`.
*   **External Plugins**: Aplicações de terceiros que estendem a funcionalidade do LifeOS, interagindo via `LifeOS SDK` e respeitando o `Permission Manager`.

## Conclusão

O mapa do sistema LifeOS revela uma arquitetura robusta e bem definida, onde a centralização da coordenação no `Life Kernel` e a comunicação baseada em eventos garantem modularidade, escalabilidade e resiliência. Cada Engine tem um papel claro, e as interfaces são projetadas para permitir tanto a interação interna quanto a extensibilidade externa de forma segura e controlada.
