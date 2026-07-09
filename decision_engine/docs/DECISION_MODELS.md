# Decision Models

Este documento descreve as estruturas de dados fundamentais utilizadas no Decision Engine.

## Objeto `Decision`

O objeto `Decision` é a unidade básica de saída do sistema. Ele encapsula o "o quê" e o "porquê" de uma escolha.

### Atributos Principais

| Atributo | Tipo | Descrição |
|----------|------|-----------|
| `decision_id` | `str` | Identificador único (UUID). |
| `timestamp` | `float` | Momento em que a decisão foi gerada. |
| `confidence_score` | `float` | Nível de confiança da IA na decisão (0.0 a 1.0). |
| `reasoning` | `List[str]` | Lista de passos lógicos que justificam a decisão. |
| `priority` | `int` | Score de prioridade (0 a 100), calculado pelo Priority Engine. |
| `affected_context` | `List[str]` | Domínios ou contextos que serão impactados pela decisão. |
| `dependencies` | `List[str]` | IDs de outras decisões que precisam ocorrer antes desta. |
| `alternative_decisions` | `List[str]` | IDs de decisões alternativas consideradas e descartadas. |
| `action_type` | `str` | Categoria da decisão (ex: `goal_pursuit`, `event_response`). |
| `metadata` | `Dict` | Dados brutos adicionais para rastreabilidade. |

## Objeto `ContextInput`

O `ContextInput` é o pacote de dados recebido pelos motores externos, servindo de matéria-prima para as decisões.

- `life_graph_data`: Objetivos, metas e progresso do usuário.
- `context_engine_data`: Eventos recentes e sinais do ambiente.
- `memory_engine_data`: Padrões históricos e memórias recorrentes.

## Objeto `Conflict`

Representa um choque detectado entre duas ou mais decisões.

- `conflict_id`: Identificador único.
- `involved_decisions`: IDs das decisões em conflito.
- `severity`: Nível de gravidade do conflito (1 a 10).
- `resolution_strategy`: Estratégia aplicada para resolver (ex: `priority_wins`).
- `resolved`: Booleano indicando se o conflito foi tratado.
