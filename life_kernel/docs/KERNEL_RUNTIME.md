# Kernel Runtime

**Project-X | Sprint 016**

O `Kernel Runtime` é o coração operacional do Life Kernel, atuando como o orquestrador principal que gerencia o ciclo de vida do sistema LifeOS. Ele é responsável por iniciar, manter e coordenar a execução de todos os Engines, garantindo que os eventos sejam processados, as tarefas agendadas sejam executadas e o estado global do sistema seja mantido de forma consistente. O `Kernel Runtime` encapsula a complexidade da concorrência e da comunicação assíncrona, apresentando uma interface unificada para a interação com os Engines.

## Objetivo e Funções

O principal objetivo do `Kernel Runtime` é fornecer um ambiente de execução robusto e eficiente para o LifeOS. Suas funções chave incluem:

*   **Inicialização e Gerenciamento do Ciclo de Vida**: Inicia e encerra o Kernel, controlando o fluxo principal de execução.
*   **Processamento de Eventos**: Extrai eventos da `Event Queue` e os despacha para os `Engines` subscritos através do `Kernel Event Manager`.
*   **Execução de Tarefas Agendadas**: Colabora com o `Kernel Scheduler` para garantir que eventos e tarefas sejam executados no tempo certo.
*   **Manutenção do Estado Global**: Interage com o `Kernel State Manager` para registrar e atualizar o status dos `Engines` e métricas do sistema.
*   **Monitoramento e Recuperação**: Trabalha em conjunto com o `Kernel Monitor` para verificar a saúde do sistema e iniciar processos de recuperação quando necessário.
*   **Abstração da Concorrência**: Gerencia threads ou processos para lidar com a execução assíncrona de eventos e tarefas.

## Componentes Integrados

O `Kernel Runtime` integra e orquestra os seguintes componentes do Life Kernel:

| Componente | Relação com o Kernel Runtime |
|---|---|
| **Kernel Event Manager** | O `Kernel Runtime` utiliza o `Kernel Event Manager` para publicar eventos e para processar eventos da fila, despachando-os para os `Engines` apropriados. |
| **Kernel State Manager** | O `Kernel Runtime` atualiza o `Kernel State Manager` com métricas de eventos processados, carga do sistema e status dos `Engines`. |
| **Kernel Scheduler** | O `Kernel Runtime` invoca o `Kernel Scheduler` periodicamente para verificar e despachar tarefas agendadas para a `Event Queue`. |
| **Kernel Monitor** | O `Kernel Runtime` aciona o `Kernel Monitor` para realizar verificações de saúde e, se necessário, iniciar procedimentos de recuperação para `Engines` com problemas. |

## Ciclo de Execução (Run Loop)

O `Kernel Runtime` opera em um loop contínuo que realiza as seguintes ações:

1.  **Processa Tarefas Agendadas**: Chama o `Kernel Scheduler` para mover quaisquer eventos agendados que atingiram seu tempo de execução para a `Event Queue`.
2.  **Processa Próximo Evento**: Extrai o evento de maior prioridade da `Event Queue` (via `Kernel Event Manager`).
3.  **Despacha Evento**: O `Kernel Event Manager` notifica todos os `Engines` subscritos sobre o evento, que então o processam.
4.  **Atualiza Métricas**: O `Kernel Runtime` atualiza o `Kernel State Manager` com o número de eventos ativos e processados.
5.  **Monitoramento de Saúde**: Periodicamente, o `Kernel Runtime` aciona o `Kernel Monitor` para realizar um `health check` do sistema.
6.  **Atualiza Carga do Sistema**: A carga do sistema é atualizada com base no tamanho das filas de eventos e tarefas agendadas.
7.  **Pausa Curta**: Uma pequena pausa é introduzida para evitar o consumo excessivo de CPU (busy-waiting) quando não há eventos para processar.

## Comunicação com Engines (Mock para Demonstração)

Para fins de demonstração e teste, o `Kernel Runtime` utiliza `MockEngines`. Estes `MockEngines` simulam o comportamento dos `Engines` reais do LifeOS, registrando-se no `Kernel Runtime`, subscrevendo a tipos de eventos e processando-os. Isso permite testar o fluxo de comunicação e coordenação do Kernel sem a necessidade de instanciar todos os `Engines` complexos do LifeOS.

## Publicação de Eventos

O `Kernel Runtime` fornece um método `publish_event` que permite a qualquer componente externo (ou mesmo outros `Engines` via `Kernel Event Manager`) injetar eventos no sistema. Isso garante que todas as interações passem pelo Kernel, mantendo a arquitetura centralizada.

O `Kernel Runtime` é a garantia de que o LifeOS opera de forma coesa e reativa, transformando uma coleção de `Engines` em um sistema inteligente e dinâmico.
