# Kernel State Manager

**Project-X | Sprint 016**

O `Kernel State Manager` é o componente do Life Kernel responsável por manter e fornecer uma visão consistente e atualizada do estado global do LifeOS. Ele atua como uma fonte centralizada de verdade para informações operacionais, como o status de cada Engine, métricas de processamento de eventos e a carga geral do sistema. Ao centralizar o gerenciamento de estado, o `Kernel State Manager` facilita o monitoramento, o diagnóstico e a tomada de decisões pelo `Kernel Runtime` e pelo `Kernel Monitor`.

## Objetivo e Importância

O principal objetivo do `Kernel State Manager` é garantir que todos os componentes do LifeOS tenham acesso a informações de estado precisas e em tempo real. Sua importância reside em:

*   **Consistência**: Fornecer uma visão unificada do estado do sistema, evitando inconsistências entre diferentes Engines.
*   **Observabilidade**: Expor métricas e status que são cruciais para entender o comportamento e a saúde do LifeOS.
*   **Tomada de Decisão**: Permitir que o `Kernel Runtime` e o `Kernel Monitor` tomem decisões informadas sobre agendamento, balanceamento de carga e recuperação de falhas.
*   **Simplicidade**: Abstrair a complexidade de coletar e agregar informações de estado de múltiplos Engines.

## O Estado do Kernel (`KernelState`)

O estado global é encapsulado em um objeto `KernelState`, que contém os seguintes atributos:

| Atributo | Tipo | Descrição |
|---|---|---|
| `engine_statuses` | `Dict[str, EngineStatus]` | Um dicionário que mapeia o nome de cada Engine para seu status atual (ONLINE, OFFLINE, BUSY, ERROR, RECOVERING). |
| `last_update` | `datetime` | O timestamp da última atualização de qualquer parte do estado. |
| `active_events` | `int` | O número de eventos que estão atualmente em processamento ou aguardando na fila. |
| `total_events_processed` | `int` | O número total de eventos que foram processados pelo Kernel desde a inicialização. |
| `system_load` | `float` | Uma métrica que representa a carga atual do sistema, geralmente baseada no tamanho das filas de eventos e tarefas agendadas. |

## Funcionalidades Principais

O `Kernel State Manager` oferece as seguintes funcionalidades para gerenciar o estado:

*   **`update_engine_status(engine_name: str, status: EngineStatus)`**: Atualiza o status operacional de um Engine específico. Isso é crucial para o `Kernel Monitor` detectar problemas.
*   **`get_engine_status(engine_name: str)`**: Retorna o status atual de um Engine.
*   **`update_event_metrics(active_events_delta: int, processed_events_delta: int)`**: Ajusta as contagens de eventos ativos e processados. Usado pelo `Kernel Runtime` para manter as métricas atualizadas.
*   **`update_system_load(load: float)`**: Define a carga atual do sistema. Pode ser calculada com base em vários fatores, como o tamanho das filas.
*   **`get_current_state()`**: Retorna o objeto `KernelState` completo.
*   **`get_current_state_dict()`**: Retorna o estado atual como um dicionário, útil para serialização ou exibição em dashboards.

## Interação com Outros Componentes do Kernel

*   **Kernel Runtime**: O `Kernel Runtime` é o principal consumidor e atualizador do estado. Ele consulta o estado para tomar decisões sobre o processamento de eventos e atualiza o estado com métricas de execução.
*   **Kernel Monitor**: O `Kernel Monitor` depende fortemente do `Kernel State Manager` para obter o status de todos os Engines e outras métricas para realizar seus `health checks` e decidir sobre ações de recuperação.
*   **Engines**: Embora os Engines não interajam diretamente com o `Kernel State Manager` para manter o desacoplamento, o `Kernel Runtime` pode usar informações de estado para influenciar o comportamento dos Engines (ex: não despachar eventos para um Engine `OFFLINE` ou `ERROR`).

### Exemplo de Uso

```python
from life_kernel.core.state_manager import KernelStateManager
from life_kernel.core.models import EngineStatus

sm = KernelStateManager()

# Atualizar status de um Engine
sm.update_engine_status("LifeGraph", EngineStatus.ONLINE)
sm.update_engine_status("DecisionEngine", EngineStatus.BUSY)

print(f"Status do LifeGraph: {sm.get_engine_status("LifeGraph").value}")
print(f"Status do DecisionEngine: {sm.get_engine_status("DecisionEngine").value}")

# Simular um erro
sm.update_engine_status("ActionEngine", EngineStatus.ERROR)
print(f"Status do ActionEngine: {sm.get_engine_status("ActionEngine").value}")

# Atualizar métricas de eventos
sm.update_event_metrics(active_events_delta=5, processed_events_delta=10)
sm.update_system_load(0.75)

# Obter o estado atual
current_state = sm.get_current_state_dict()
print("\nEstado atual do Kernel:")
for key, value in current_state.items():
    print(f"  {key}: {value}")
```

O `Kernel State Manager` é a bússola do LifeOS, fornecendo a visibilidade e o controle necessários para que o sistema opere de forma eficiente, confiável e adaptável.
