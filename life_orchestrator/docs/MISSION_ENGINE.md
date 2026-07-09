# Mission Engine

**Project-X | Sprint 013**

O Mission Engine é o componente do Life Orchestrator responsável pela gestão centralizada das Missões e seus respectivos passos. Ele permite a criação, detalhamento, acompanhamento e atualização do progresso de cada objetivo de vida do usuário.

## Funcionalidades Principais

O Mission Engine oferece as seguintes capacidades:

*   **Criação de Missões**: Permite definir novos objetivos de vida com título, objetivo detalhado e prioridade inicial.
*   **Quebra em Passos (Mission Steps)**: Automaticamente ou com input do usuário, divide uma missão complexa em etapas menores e gerenciáveis. Cada passo pode ter suas próprias dependências e ser atribuído a um motor específico (ex: Action Engine para execução).
*   **Atualização de Status**: Gerencia o status da missão (rascunho, ativa, pausada, concluída, cancelada) e de cada passo (pendente, em progresso, concluído, bloqueado).
*   **Cálculo de Progresso**: Calcula o progresso geral da missão com base na conclusão de seus passos, fornecendo uma visão clara do avanço.
*   **Associação de Riscos e Oportunidades**: Permite vincular riscos e oportunidades identificados pelo Future Engine diretamente à missão, enriquecendo o planejamento.

## Estrutura de Dados

### Mission

Representa um objetivo de vida do usuário. Seus atributos incluem:

| Atributo | Descrição |
|---|---|
| `mission_id` | Identificador único da missão. |
| `title` | Nome curto e descritivo da missão. |
| `objective` | Descrição detalhada do que se deseja alcançar. |
| `priority` | Prioridade dinâmica (0-100), influenciada pelo Priority Engine. |
| `status` | Estado atual da missão (ex: `active`, `completed`). |
| `progress` | Percentual de conclusão (0.0-100.0). |
| `steps` | Lista de `MissionStep`s que compõem a missão. |
| `dependencies` | IDs de outras missões das quais esta depende. |
| `risks` | Lista de riscos associados à missão. |
| `opportunities` | Lista de oportunidades associadas à missão. |
| `created_at` | Timestamp de criação. |
| `updated_at` | Último timestamp de atualização. |
| `metadata` | Dados adicionais relevantes. |

### MissionStep

Representa uma etapa individual dentro de uma missão. Seus atributos incluem:

| Atributo | Descrição |
|---|---|
| `step_id` | Identificador único do passo. |
| `title` | Nome curto do passo. |
| `description` | Detalhes do que precisa ser feito. |
| `status` | Estado atual do passo (ex: `pending`, `completed`). |
| `dependencies` | IDs de outros passos dentro da mesma missão dos quais este depende. |
| `assigned_engine` | Qual motor do LifeOS é o principal responsável por este passo (ex: `ActionEngine`). |
| `metadata` | Dados adicionais relevantes. |

## Fluxo de Operação

1.  O usuário define um objetivo, que se torna uma nova `Mission`.
2.  O Mission Engine, possivelmente com auxílio do usuário ou de IA, quebra a missão em `MissionStep`s.
3.  O Orchestrator Runtime monitora o progresso dos passos.
4.  À medida que os passos são concluídos, o Mission Engine atualiza o `progress` da missão.
5.  Riscos e oportunidades são dinamicamente associados à missão pelo Future Engine e gerenciados pelo Mission Engine.

O Mission Engine é fundamental para transformar grandes aspirações em um plano de ação concreto e rastreável, permitindo que o LifeOS guie o usuário de forma eficaz em direção aos seus objetivos.
