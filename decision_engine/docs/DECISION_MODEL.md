# Decision Model

**Projeto:** PROJECT-X | **Fase:** 3 | **Sprint:** 021

O **Decision Model** define a estrutura de dados padronizada para todas as decisões geradas pelo Decision Engine. Esta estrutura garante que toda recomendação seja rastreável, explicável e pronta para receber feedback.

## Estrutura Principal (`Decision`)

Cada decisão gerada contém os seguintes campos:

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `decision_id` | `str` | Identificador único (UUID) da decisão. |
| `timestamp` | `float` | Data e hora em que a decisão foi gerada. |
| `related_goal` | `str` | Objetivo do usuário ao qual esta decisão está vinculada. |
| `category` | `str` | Categoria da decisão (Saúde, Finanças, Produtividade, etc.). |
| `context_used` | `Dict[str, Any]` | Dicionário com todas as variáveis de contexto que influenciaram a decisão. |
| `factor_weights` | `Dict[str, float]` | Pesos aplicados aos fatores de contexto (ex: `urgency`, `energy_conservation`). |
| `alternatives` | `List[Alternative]` | Lista de alternativas consideradas antes da recomendação final. |
| `confidence_score` | `float` | Grau de confiança da IA na recomendação (0.0 a 1.0). |
| `decision_score` | `float` | Pontuação calculada para a alternativa vencedora (0 a 100). |
| `recommendation` | `str` | Ação final recomendada ao usuário. |
| `reasoning` | `List[str]` | Passos lógicos e auditáveis que levaram à recomendação. |
| `justification` | `str` | Explicação textual, amigável para humanos, do porquê esta opção foi escolhida. |
| `possible_risks` | `List[str]` | Riscos potenciais associados à recomendação. |
| `possible_benefits` | `List[str]` | Benefícios esperados caso a recomendação seja seguida. |
| `priority` | `int` | Nível de prioridade da decisão (0 a 100). |
| `status` | `str` | Estado atual da decisão no histórico (`pending`, `accepted`, `rejected`). |

## Estrutura de Alternativas (`Alternative`)

Antes de gerar uma recomendação final, o motor avalia múltiplas opções. Cada opção é modelada como uma `Alternative`:

| Campo | Tipo | Descrição |
| :--- | :--- | :--- |
| `alternative_id` | `str` | Identificador único (UUID) da alternativa. |
| `description` | `str` | Descrição da ação alternativa. |
| `pros` | `List[str]` | Lista de pontos positivos desta alternativa. |
| `cons` | `List[str]` | Lista de pontos negativos ou riscos desta alternativa. |
| `estimated_impact` | `float` | Pontuação simulada desta alternativa durante a avaliação (0 a 100). |

## Explicabilidade (Explainability)

O modelo inclui o método `explain()`, que sintetiza a `justification` e a lista de `reasoning` em um texto coeso e de fácil leitura. Isso é fundamental para a camada de *Human Experience*, garantindo que o usuário compreenda o "raciocínio" da máquina antes de aceitar ou rejeitar uma recomendação.
