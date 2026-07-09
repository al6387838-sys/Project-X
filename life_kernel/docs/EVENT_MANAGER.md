# Kernel Event Manager

**Project-X | Sprint 016**

O `Kernel Event Manager` é o componente central do Life Kernel responsável por facilitar a comunicação assíncrona e desacoplada entre todos os Engines do LifeOS. Ele implementa o padrão de design **Publicador-Assinante (Publisher-Subscriber)**, onde os Engines publicam eventos sem saber quem os consumirá, e outros Engines assinam tipos de eventos de seu interesse. Isso elimina a necessidade de comunicação direta entre os Engines, promovendo modularidade, escalabilidade e flexibilidade na arquitetura do LifeOS.

## Objetivo e Princípios

O principal objetivo do `Kernel Event Manager` é atuar como um barramento de eventos centralizado, garantindo que a informação flua de forma eficiente e controlada por todo o sistema. Seus princípios incluem:

*   **Desacoplamento**: Engines não precisam conhecer uns aos outros para se comunicar.
*   **Assincronicidade**: Eventos são processados em segundo plano, sem bloquear o publicador.
*   **Escalabilidade**: Facilita a adição ou remoção de Engines sem impactar o sistema como um todo.
*   **Observabilidade**: Todos os eventos passam por um ponto central, facilitando o monitoramento e o diagnóstico.

## Componentes Chave

O `Kernel Event Manager` trabalha em estreita colaboração com a `EventQueue`:

| Componente | Função na Gestão de Eventos |
|---|---|
| **Kernel Event Manager** | Gerencia as assinaturas de eventos e o despacho de eventos para os `handlers` registrados. É a interface principal para publicar e assinar eventos. |
| **Event Queue** | Uma fila de prioridade interna que armazena os `KernelEvents` aguardando processamento. Garante que eventos mais críticos sejam tratados com precedência. |

## Funcionalidades Principais

O `Kernel Event Manager` oferece as seguintes funcionalidades:

*   **`publish(event: KernelEvent)`**: Adiciona um `KernelEvent` à `EventQueue`. O evento é então processado assincronamente pelo `Kernel Runtime`.
*   **`subscribe(event_type: str, handler: Callable[[KernelEvent], None])`**: Permite que um `Engine` (ou qualquer componente) registre uma função `handler` para ser chamada sempre que um evento de um `event_type` específico for publicado.
*   **`unsubscribe(event_type: str, handler: Callable[[KernelEvent], None])`**: Remove uma assinatura existente.
*   **`process_next_event()`**: (Chamado pelo `Kernel Runtime`) Extrai o próximo evento da `EventQueue` e o despacha para todos os `handlers` subscritos para aquele tipo de evento.
*   **`get_queue_size()`**: Retorna o número de eventos atualmente na `EventQueue`.

## O `KernelEvent`

Todos os eventos que trafegam pelo `Kernel Event Manager` são encapsulados em um objeto `KernelEvent`, que contém:

*   `event_id`: Um identificador único para o evento.
*   `timestamp`: O momento em que o evento foi criado.
*   `event_type`: Uma string que categoriza o evento (ex: "USER_ACTION", "MISSION_COMPLETED", "DATA_UPDATED").
*   `source`: O nome do `Engine` ou componente que publicou o evento.
*   `payload`: Um dicionário contendo os dados específicos do evento.
*   `priority`: O nível de prioridade do evento (CRITICAL, HIGH, MEDIUM, LOW), usado pela `EventQueue`.
*   `target`: Opcional. Um `Engine` específico para o qual o evento é direcionado, embora ainda passe pelo barramento.

## Fluxo de Eventos

1.  Um `Engine` (ex: `Action Engine`) executa uma ação e precisa notificar outros `Engines`.
2.  Ele cria um `KernelEvent` (ex: `event_type="ACTION_COMPLETED"`, `source="ActionEngine"`, `payload={...}`) e o publica via `Kernel Event Manager.publish()`.
3.  O `Kernel Event Manager` adiciona o evento à `EventQueue`.
4.  O `Kernel Runtime` extrai o evento da `EventQueue`.
5.  O `Kernel Event Manager` consulta suas assinaturas e identifica quais `Engines` (ex: `Evolution Engine`, `Trust Engine`) assinaram para eventos do tipo `ACTION_COMPLETED`.
6.  Para cada `Engine` subscrito, o `Kernel Event Manager` invoca o `handler` registrado, passando o `KernelEvent` como argumento.
7.  Os `Engines` subscritos processam o evento de forma independente.

### Exemplo de Uso (Publicação e Assinatura)

```python
from life_kernel.core.event_manager import KernelEventManager
from life_kernel.core.models import KernelEvent, EventPriority

def my_handler(event: KernelEvent):
    print(f"Handler recebeu evento: {event.event_type} de {event.source} com payload {event.payload}")

em = KernelEventManager()

# Um engine se subscreve a um tipo de evento
em.subscribe("USER_ACTION", my_handler)

# Outro engine publica um evento
user_event = KernelEvent("USER_ACTION", "UI", {"action": "click", "element": "button_save"}, EventPriority.HIGH)
em.publish(user_event)

# O Kernel Runtime processaria o evento (simulado aqui)
processed_event = em.process_next_event()
# Saída esperada: Handler recebeu evento: USER_ACTION de UI com payload {"action": "click", "element": "button_save"}
```

O `Kernel Event Manager` é a cola que une os diversos `Engines` do LifeOS, permitindo que o sistema funcione como um todo coeso e reativo, sem a complexidade de dependências diretas entre seus componentes.
