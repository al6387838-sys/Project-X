# Dependency Engine

**Project-X | Sprint 013**

O Dependency Engine é um componente crucial do Life Orchestrator, responsável por gerenciar as relações de dependência entre missões e seus passos. Ele assegura que as ações sejam executadas na sequência lógica correta, prevenindo a execução prematura de tarefas e identificando proativamente bloqueios que possam impedir o progresso.

## Como Funciona

O Dependency Engine monitora as dependências de cada `Mission` e `MissionStep`. Uma dependência significa que uma determinada missão ou passo só pode ser iniciado ou considerado ativo após a conclusão de outra missão ou passo. O motor realiza as seguintes verificações:

*   **Dependências de Passos**: Verifica se todos os passos predecessores de um `MissionStep` específico foram marcados como `completed` antes que o passo atual possa ser iniciado.
*   **Dependências de Missões**: Verifica se todas as `Mission`s predecessoras foram marcadas como `completed` antes que uma nova missão possa ser ativada ou progredir.

## Identificação de Bloqueios

Uma das funções mais importantes do Dependency Engine é a capacidade de identificar e sinalizar bloqueios. Se um passo ou missão não pode avançar porque uma de suas dependências não foi cumprida, o motor:

*   Marca o passo ou missão como `blocked`.
*   Pode notificar o Life Companion para alertar o usuário sobre o bloqueio e as dependências pendentes.
*   Fornece informações para o Priority Engine, que pode ajustar a prioridade das missões bloqueadoras para acelerar o progresso.

## Estrutura de Dependências

As dependências são definidas nas estruturas de dados `Mission` e `MissionStep`:

*   **`Mission.dependencies`**: Uma lista de `mission_id`s de outras missões que devem ser concluídas antes que esta missão possa ser considerada desbloqueada.
*   **`MissionStep.dependencies`**: Uma lista de `step_id`s de outros passos dentro da mesma missão que devem ser concluídos antes que este passo possa ser iniciado.

## Integração com Outros Motores

O Dependency Engine interage principalmente com:

*   **Mission Engine**: Para acessar e atualizar o status de missões e passos, e para obter a estrutura de dependências.
*   **Orchestrator Runtime**: O runtime utiliza o Dependency Engine para verificar a viabilidade de iniciar ou continuar missões e passos, e para reagir a bloqueios.
*   **Life Companion**: Para enviar notificações ao usuário sobre bloqueios e dependências.
*   **Priority Engine**: Para informar sobre missões bloqueadas, o que pode influenciar o cálculo de prioridade.

## Benefícios

Ao gerenciar as dependências de forma eficaz, o Dependency Engine garante que o LifeOS:

*   **Promova a Ordem Lógica**: Assegura que as tarefas sejam realizadas na sequência mais eficiente e lógica.
*   **Evite Esforço Desperdiçado**: Impede que o usuário comece tarefas que não podem ser concluídas devido a pré-requisitos não atendidos.
*   **Identifique Gargalos**: Ajuda o usuário a visualizar onde o progresso está estagnado e por quê, permitindo intervenções proativas.

O Dependency Engine é fundamental para manter a fluidez e a eficiência na execução das missões do usuário, transformando um plano complexo em uma série de ações claras e interconectadas.
