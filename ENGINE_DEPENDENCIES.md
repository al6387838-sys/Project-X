# Mapa de Dependências dos Engines do LifeOS

**Project-X | Sprint 017**

## Introdução

Este documento detalha as dependências entre os diversos Engines que compõem o LifeOS. Compreender essas dependências é crucial para a manutenção, evolução e escalabilidade do sistema. A arquitetura do LifeOS foi projetada para minimizar o acoplamento direto, utilizando o `Life Kernel` como um orquestrador central e um barramento de eventos para a comunicação assíncrona. No entanto, algumas dependências lógicas e de importação ainda existem e são importantes para o funcionamento do sistema.

## Princípios de Dependência no LifeOS

1.  **Comunicação via Kernel**: A regra fundamental é que os Engines não devem se comunicar diretamente. Toda a interação deve ser mediada pelo `Life Kernel` através de eventos.
2.  **Dependências de Importação**: Embora a comunicação seja via Kernel, os Engines podem ter dependências de importação para acessar modelos de dados ou classes auxiliares de outros Engines. Idealmente, essas dependências devem ser minimizadas e, quando existirem, devem ser unidirecionais para evitar ciclos.
3.  **Injeção de Dependência**: O `Life Kernel` é responsável por instanciar e gerenciar os Engines, injetando as dependências necessárias (como o `Kernel Event Manager` e `Kernel State Manager`) em cada Engine.

## Mapeamento de Dependências de Importação

Abaixo está um mapeamento das dependências de importação identificadas através da análise do código-fonte. Este mapa foca nas importações entre os pacotes de Engines de alto nível.

| Engine Fonte | Engine Destino | Tipo de Dependência | Observações |
|---|---|---|---|
| `life_orchestrator` | `evolution_engine` | Importação de Classe | `OrchestratorRuntime` importa `EvolutionEngine` para integração. |
| `life_orchestrator` | `future_engine` | Importação de Classe | `OrchestratorRuntime` importa `FutureEngine` para integração. |
| `lifeos_sdk` | `life_kernel` | Importação de Classe | O SDK interage com o `Life Kernel` para publicar eventos e consultar estados. |
| `trust_engine` | `life_kernel` | Importação de Classe | O `Trust Engine` pode registrar eventos no `Kernel` e consultar estados para auditoria. |
| `human_experience` | `life_kernel` | Importação de Classe | A camada de experiência interage com o `Kernel` para obter dados e publicar ações do usuário. |

**Observações sobre as Dependências de Importação:**

*   As dependências listadas acima são principalmente para que os Engines de nível superior (como `Life Orchestrator` e `LifeOS SDK`) possam instanciar ou interagir com outros Engines de forma controlada, geralmente através do `Life Kernel`.
*   O `Life Kernel` é o ponto central de dependência, pois todos os Engines se registram nele e o utilizam para comunicação. Isso é intencional e faz parte do design centralizado do Kernel.
*   Não foram detectadas dependências circulares diretas entre os Engines principais, o que é um bom indicativo de um design modular.

## Fluxos de Comunicação Baseados em Eventos (via Life Kernel)

Embora as dependências de importação sejam importantes, a principal forma de interação entre os Engines é através do `Kernel Event Manager`. Este é um fluxo de comunicação indireto e desacoplado.

**Exemplos de Fluxos de Eventos:**

*   **`USER_ACTION` (UI -> Kernel -> Action Engine)**: A `Human Experience` (UI) publica um evento `USER_ACTION`. O `Kernel Event Manager` o encaminha para o `Action Engine` (e outros Engines subscritos, como `Context Engine`, `Evolution Engine`).
*   **`MISSION_COMPLETED` (Mission Engine -> Kernel -> Evolution Engine, Trust Engine, Future Engine)**: Quando o `Mission Engine` conclui uma missão, ele publica um evento `MISSION_COMPLETED`. O `Evolution Engine` o utiliza para aprendizado, o `Trust Engine` para registro de auditoria, e o `Future Engine` para recalcular cenários.
*   **`CONTEXT_UPDATED` (Context Engine -> Kernel -> Decision Engine, Future Engine)**: O `Context Engine` publica um evento `CONTEXT_UPDATED` quando o contexto do usuário muda. O `Decision Engine` e o `Future Engine` reagem a isso para ajustar decisões e previsões.

## Conclusão

A arquitetura do LifeOS demonstra um bom nível de desacoplamento entre os Engines, com o `Life Kernel` atuando efetivamente como o mediador central. As dependências de importação são gerenciadas e não apresentam ciclos diretos, o que contribui para a robustez e manutenibilidade do sistema. A comunicação baseada em eventos é o pilar para a escalabilidade e flexibilidade, permitindo que o sistema evolua e se adapte sem a necessidade de reescrever grandes partes do código.
