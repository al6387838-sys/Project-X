# Decision History

**Project-X | Sprint 015**

O `Decision History` é o repositório central e imutável de todas as decisões tomadas pelo LifeOS. Ele atua como a memória de longo prazo do sistema em relação às suas próprias ações, garantindo que cada intervenção, sugestão ou ajuste seja registrado com detalhes completos. Este componente é a base para a auditabilidade, transparência e explicabilidade, permitindo que o usuário e outros motores do LifeOS compreendam o histórico operacional do sistema.

## Propósito e Importância

O principal propósito do `Decision History` é:

*   **Imutabilidade**: Garantir que, uma vez registrada, uma decisão não possa ser alterada ou apagada, fornecendo uma trilha de auditoria confiável.
*   **Rastreabilidade**: Permitir a rastreabilidade completa de qualquer ação do LifeOS até o momento de sua origem, o motor responsável e os dados que a influenciaram.
*   **Contexto Histórico**: Fornecer um rico contexto histórico para o `Reasoning Engine` gerar explicações detalhadas e para o `Audit Engine` analisar padrões de decisão.
*   **Base para Confiança**: Ao registrar abertamente todas as decisões, o `Decision History` constrói a confiança do usuário no LifeOS.

## O Registro de Decisão (`DecisionRecord`)

Cada entrada no `Decision History` é um objeto `DecisionRecord`, que encapsula todas as informações relevantes sobre uma decisão específica. Os atributos de um `DecisionRecord` são:

| Atributo | Tipo | Descrição |
|---|---|---|
| `decision_id` | `str` | Um identificador único (UUID) para cada decisão. |
| `timestamp` | `datetime` | A data e hora exatas em que a decisão foi registrada. |
| `engine_responsible` | `str` | O nome do motor do LifeOS que originou a decisão (ex: "DecisionEngine", "FutureEngine"). |
| `data_used` | `Dict[str, Any]` | Um dicionário contendo os dados e o contexto que foram consultados ou utilizados para chegar à decisão. |
| `confidence_level` | `ConfidenceLevel` | O nível de confiança que o LifeOS atribuiu à sua própria decisão no momento do registro. |
| `explanation` | `str` | Uma breve descrição ou justificativa da decisão, em linguagem natural. |
| `alternatives_considered` | `List[Dict[str, Any]]` | Uma lista de outras opções ou caminhos que foram avaliados, mas não escolhidos, incluindo seus potenciais impactos. |
| `user_id` | `str` | O identificador do usuário para quem a decisão foi tomada. |
| `metadata` | `Optional[Dict[str, Any]]` | Um dicionário opcional para armazenar informações adicionais ou tags relevantes para a decisão. |

## Funcionalidades Principais

O `DecisionHistory` oferece as seguintes funcionalidades:

*   **`record_decision(...)`**: Registra uma nova decisão, gerando um `decision_id` único e um `timestamp`.
*   **`get_decision_by_id(decision_id)`**: Recupera um `DecisionRecord` específico usando seu ID.
*   **`get_decisions_for_user(user_id, limit)`**: Retorna uma lista de `DecisionRecord`s para um usuário específico, ordenados cronologicamente inversamente, com um limite opcional.
*   **`get_all_decisions(limit)`**: Retorna uma lista de todos os `DecisionRecord`s registrados no sistema, com um limite opcional.

### Exemplo de Uso

```python
from trust_engine.engines.decision_history import DecisionHistory
from trust_engine.models.trust import ConfidenceLevel
from datetime import datetime

dh = DecisionHistory()

# Registrar uma decisão
decision_data = {
    "user_id": "usuario_teste",
    "engine_responsible": "DecisionEngine",
    "data_used": {"prioridade_missao": 90, "risco_associado": "baixo"},
    "confidence_level": ConfidenceLevel.HIGH,
    "explanation": "Sugeriu iniciar a Missão X devido à alta prioridade e baixo risco.",
    "alternatives_considered": [
        {"description": "Aguardar uma semana", "impact": "atraso no objetivo"}
    ]
}
record = dh.record_decision(**decision_data)
print(f"Decisão registrada com ID: {record.decision_id}")

# Recuperar a decisão
retrieved_record = dh.get_decision_by_id(record.decision_id)
if retrieved_record:
    print(f"Explicação da decisão: {retrieved_record.explanation}")

# Obter decisões para um usuário
user_decisions = dh.get_decisions_for_user("usuario_teste")
print(f"Total de decisões para usuario_teste: {len(user_decisions)}")
```

O `Decision History` é a prova concreta da atuação do LifeOS, permitindo que o usuário tenha controle e compreensão sobre como o sistema está influenciando sua vida.
