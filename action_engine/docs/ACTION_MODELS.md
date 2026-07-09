# Action Models

Este documento descreve as estruturas de dados fundamentais utilizadas no Action Engine para representar e gerenciar ações.

## Objeto `Action`

O objeto `Action` é a representação de uma tarefa executável gerada a partir de uma decisão. Ele contém todas as informações necessárias para o planejamento, execução, aprovação e rastreamento.

### Atributos Principais

| Atributo | Tipo | Descrição |
|----------|------|-----------|
| `action_id` | `str` | Identificador único (UUID) da ação. |
| `timestamp` | `float` | Momento em que a ação foi criada. |
| `priority` | `int` | Prioridade da ação (0 a 100), herdada da decisão ou ajustada. |
| `execution_status` | `str` | Estado atual da ação (ex: `pending`, `approved`, `executing`, `completed`, `failed`, `rolled_back`). |
| `approval_required` | `bool` | Indica se a ação necessita de aprovação humana antes da execução. |
| `origin_decision_id` | `Optional[str]` | ID da decisão que originou esta ação. |
| `expected_result` | `str` | Descrição do resultado esperado após a execução da ação. |
| `rollback_strategy` | `str` | Estratégia para reverter a ação em caso de falha (ex: `none`, `automatic`, `manual`). |
| `justification` | `str` | O *porquê* da ação, herdado do raciocínio da decisão. |
| `origin` | `str` | Fonte da ação (ex: `DecisionEngine`, `AutomationEngine`). |
| `objective` | `str` | O *que* a ação pretende alcançar. |
| `action_type` | `str` | Categoria da ação para roteamento (ex: `email`, `calendar`, `iot`). |
| `parameters` | `Dict` | Parâmetros específicos para a execução da ação (ex: `to`, `subject` para e-mail). |
| `metadata` | `Dict` | Dados adicionais para rastreabilidade e contexto. |

## Objeto `ActionGroup`

O `ActionGroup` permite agrupar múltiplas ações que estão logicamente relacionadas ou que devem ser executadas em conjunto para atingir um objetivo maior.

### Atributos Principais

| Atributo | Tipo | Descrição |
|----------|------|-----------|
| `group_id` | `str` | Identificador único (UUID) do grupo de ações. |
| `name` | `str` | Nome descritivo do grupo. |
| `actions` | `List[Action]` | Lista de objetos `Action` que compõem o grupo. |
| `status` | `str` | Estado atual do grupo (ex: `pending`, `executing`, `completed`, `failed`, `cancelled`). |
| `description` | `str` | Descrição detalhada do propósito do grupo. |
| `metadata` | `Dict` | Dados adicionais para rastreabilidade. |

O `ActionGroup` facilita a gestão de fluxos de trabalho complexos, permitindo que o sistema trate um conjunto de ações como uma única unidade lógica para fins de planejamento, execução e monitoramento.
