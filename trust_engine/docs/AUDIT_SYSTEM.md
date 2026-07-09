# Audit System

**Project-X | Sprint 015**

O Audit System, implementado principalmente pelo `Audit Engine` e suportado pelo `Decision History`, é um componente crítico do Trust Engine do LifeOS. Sua função é garantir a **rastreabilidade e a capacidade de auditoria** de todas as decisões tomadas pelo sistema. Ele fornece ao usuário e, se aplicável, a auditores externos, uma visão clara e detalhada de como e por que o LifeOS agiu de determinada maneira, promovendo a transparência e a confiança.

## Objetivo e Funcionalidades

O Audit System tem como objetivo principal:

*   **Registrar Imutavelmente**: Todas as decisões são registradas de forma persistente e imutável no `Decision History`.
*   **Fornecer Trilhas de Auditoria**: Permitir que o usuário (ou um auditor) revise a sequência de eventos e decisões que levaram a um determinado resultado.
*   **Resumir Atividade de Decisão**: Oferecer visões consolidadas sobre a atividade de decisão do LifeOS para um usuário, incluindo métricas de confiança e motores envolvidos.
*   **Suportar Explicabilidade**: Fornecer os dados brutos e o contexto necessários para que o `Reasoning Engine` possa gerar explicações detalhadas.

## Componentes Chave

| Componente | Descrição |
|---|---|
| **Decision History** | O repositório central onde cada `DecisionRecord` é armazenado. Ele garante que nenhuma decisão seja perdida ou alterada, formando a base para todas as funcionalidades de auditoria. |
| **Audit Engine** | A interface programática para consultar e analisar os dados do `Decision History`. Ele abstrai a complexidade de busca e agregação, fornecendo resumos e trilhas de auditoria formatadas. |

## Trilhas de Auditoria Detalhadas

O `Audit Engine` permite a recuperação de uma trilha de auditoria completa para um usuário, filtrada por período. Cada entrada na trilha é um `DecisionRecord` que contém:

*   `decision_id`: Identificador único da decisão.
*   `timestamp`: Data e hora exatas da decisão.
*   `engine_responsible`: O motor do LifeOS que tomou a decisão (ex: `Decision Engine`, `Future Engine`).
*   `data_used`: Um dicionário contendo todos os dados e contexto que foram considerados na tomada da decisão.
*   `confidence_level`: O nível de confiança que o LifeOS tinha na decisão naquele momento.
*   `explanation`: A explicação gerada pelo LifeOS para a decisão.
*   `alternatives_considered`: Uma lista de alternativas que foram avaliadas, mas não escolhidas, com seus respectivos impactos.
*   `user_id`: O identificador do usuário.

### Exemplo de Uso (Trilha de Auditoria)

```python
from trust_engine.engines.trust_engine import TrustEngine
from datetime import datetime, timedelta

trust_engine = TrustEngine()
user_id = "usuario_exemplo"

# Simular algumas decisões
trust_engine.record_lifeos_decision(user_id, "DecisionEngine", {"context": "trabalho", "prioridade_missao": 80}, "Priorizou tarefa A devido ao prazo.", [{"description": "Priorizar tarefa B", "impact": "medio"}])
trust_engine.record_lifeos_decision(user_id, "FutureEngine", {"tendencia": "crescimento", "risco": "baixo"}, "Sugeriu investimento em ativo X.", [{"description": "Manter ativo Y", "impact": "neutro"}])

# Obter trilha de auditoria para o último dia
end_date = datetime.now()
start_date = end_date - timedelta(days=1)
audit_trail = trust_engine.audit_engine.get_audit_trail_for_user(user_id, start_date, end_date)

for record_dict in audit_trail:
    print(f"\nDecisão ID: {record_dict["decision_id"]}")
    print(f"  Engine: {record_dict["engine_responsible"]}")
    print(f"  Explicação: {record_dict["explanation"]}")
    print(f"  Confiança: {record_dict["confidence_level"]}")
```

## Resumo de Decisões

Além das trilhas detalhadas, o `Audit Engine` pode gerar um resumo consolidado da atividade de decisão para um usuário em um determinado período. Este resumo inclui:

*   `total_decisions`: Número total de decisões registradas.
*   `decisions_by_engine`: Contagem de decisões por cada motor do LifeOS.
*   `confidence_distribution`: Distribuição dos níveis de confiança (Muito Alto, Alto, Médio, Baixo) das decisões.
*   `most_recent_decision`: A decisão mais recente tomada para o usuário.

Este resumo é ideal para dashboards de confiança e para que o usuário tenha uma visão macro da atuação do LifeOS em sua vida.

## Timelines de Decisão e Confiança

O Audit System também é responsável por fornecer os dados para a construção de timelines visuais, como a `Decision Timeline` (sequência de decisões) e a `Confidence Timeline` (evolução dos níveis de confiança), que são cruciais para a compreensão da dinâmica de interação entre o usuário e o LifeOS ao longo do tempo.

Em suma, o Audit System é a garantia de que o LifeOS opera com integridade, permitindo que o usuário entenda, questione e confie nas recomendações e ações do seu copiloto de vida.
