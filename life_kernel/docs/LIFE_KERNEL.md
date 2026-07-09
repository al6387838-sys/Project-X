# Life Kernel

**Project-X | Sprint 016**

O Life Kernel é o coração pulsante do LifeOS, atuando como o núcleo central de coordenação que integra e gerencia todos os Engines do sistema. Sua principal função é eliminar a comunicação direta entre os Engines, forçando-os a interagir exclusivamente através de um mecanismo de eventos e estados gerenciado pelo Kernel. Isso garante uma arquitetura modular, escalável e resiliente, onde cada Engine pode focar em sua responsabilidade principal sem se preocupar com a complexidade da interação com outros componentes.

## Objetivo e Princípios

O objetivo primordial do Life Kernel é transformar o conjunto de Engines do LifeOS em um **organismo inteligente e coeso**. Seus princípios fundamentais incluem:

*   **Centralização da Coordenação**: Todas as interações entre Engines são mediadas pelo Kernel.
*   **Modularidade e Desacoplamento**: Engines são independentes e se comunicam apenas via eventos, facilitando a manutenção e a evolução.
*   **Resiliência e Recuperação**: Capacidade de monitorar a saúde dos Engines e se recuperar automaticamente de falhas.
*   **Observabilidade**: Registro detalhado de eventos, estados e métricas de desempenho para diagnóstico e otimização.
*   **Gerenciamento de Recursos**: Otimização do uso de CPU, memória e outras dependências.

## Engines Coordenados pelo Kernel

O Life Kernel é responsável por coordenar a operação de todos os Engines do LifeOS, incluindo:

*   **Life Graph**: Gerenciamento do grafo de conhecimento do usuário.
*   **Memory Engine**: Armazenamento e recuperação de memórias de longo e curto prazo.
*   **Context Engine**: Análise e manutenção do contexto atual do usuário.
*   **Decision Engine**: Tomada de decisões baseada em dados e objetivos.
*   **Action Engine**: Execução de ações e automações.
*   **Future Engine**: Simulação de cenários e detecção de riscos/oportunidades.
*   **Mission Engine**: Gerenciamento de missões e seus passos.
*   **Companion**: Interação e comunicação com o usuário.
*   **Evolution Engine**: Aprendizado contínuo e adaptação do sistema.
*   **Trust Engine**: Transparência, auditabilidade e explicabilidade das decisões.

## Componentes do Life Kernel

O Life Kernel é composto por vários componentes interconectados que trabalham em harmonia:

| Componente | Responsabilidade Principal | Implementação Principal |
|---|---|---|
| **Kernel Runtime** | O orquestrador principal. Inicia e gerencia o ciclo de vida do Kernel, processa eventos, executa tarefas agendadas e coordena a interação entre os demais componentes do Kernel. | `core/kernel_runtime.py` |
| **Kernel Event Manager** | Gerencia a publicação e subscrição de eventos. Atua como um barramento de eventos centralizado, garantindo que os eventos sejam entregues aos Engines interessados. | `core/event_manager.py` |
| **Event Queue** | Uma fila de prioridade para armazenar eventos aguardando processamento, garantindo que eventos críticos sejam tratados primeiro. | `core/event_queue.py` |
| **Kernel State Manager** | Mantém o estado global do LifeOS, incluindo o status de cada Engine, métricas de eventos e carga do sistema. | `core/state_manager.py` |
| **Kernel Scheduler** | Responsável por agendar a execução de eventos e tarefas em momentos específicos ou após atrasos definidos. | `core/scheduler.py` |
| **Kernel Monitor** | Monitora a saúde dos Engines e do sistema como um todo, detecta falhas e inicia processos de recuperação automática. | `core/kernel_runtime.py` (integrado) |

## Fluxo de Comunicação e Execução

1.  **Publicação de Eventos**: Qualquer Engine (ou componente externo via SDK) pode publicar um `KernelEvent` no `Kernel Event Manager`.
2.  **Enfileiramento**: O `Kernel Event Manager` adiciona o evento à `Event Queue`, que o organiza por prioridade.
3.  **Processamento**: O `Kernel Runtime` continuamente extrai eventos da `Event Queue`.
4.  **Despacho**: O `Kernel Event Manager` despacha o evento para todos os Engines que se inscreveram para aquele tipo de evento.
5.  **Execução**: Os Engines recebem e processam o evento, atualizando seu estado interno e, opcionalmente, publicando novos eventos como resultado.
6.  **Atualização de Estado**: O `Kernel State Manager` registra o status dos Engines e métricas do sistema.
7.  **Monitoramento**: O `Kernel Monitor` verifica periodicamente a saúde dos Engines e do sistema, acionando recuperações se necessário.

## Gerenciamento de Filas

O Kernel utiliza três tipos de filas para gerenciar o fluxo de trabalho:

*   **Event Queue**: Fila de prioridade para eventos que precisam ser processados pelos Engines.
*   **Priority Queue**: (Parte da Event Queue) Garante que eventos de alta prioridade sejam processados antes de eventos de baixa prioridade.
*   **Execution Queue**: (Parte da Event Queue) Uma fila FIFO para eventos que já foram despachados e estão aguardando execução por um Engine.

## Registro e Observabilidade

O Kernel registra métricas cruciais para a observabilidade e diagnóstico do sistema:

*   **Tempo de Execução**: Duração do processamento de eventos e tarefas.
*   **Uso de Memória**: Consumo de recursos por Engine e pelo Kernel.
*   **Eventos**: Log detalhado de todos os eventos publicados e processados.
*   **Falhas**: Registro de erros e exceções nos Engines.
*   **Recuperação**: Histórico de tentativas e sucessos de recuperação automática.

## Sistema de Recovery Automático

O `Kernel Monitor` implementa um sistema de recovery automático. Ao detectar um Engine em estado de `ERROR`, ele tenta reiniciar ou reconfigurar o Engine, atualizando seu status para `RECOVERING` e, se bem-sucedido, para `ONLINE`. Isso garante a alta disponibilidade e resiliência do LifeOS.

O Life Kernel é a garantia de que o LifeOS opera como um sistema unificado, eficiente e robusto, coordenando a complexidade interna para entregar uma experiência simples e poderosa ao usuário.
