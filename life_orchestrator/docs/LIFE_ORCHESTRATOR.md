# Life Orchestrator

**Project-X | Sprint 013**

O Life Orchestrator é o coração do LifeOS, responsável por coordenar todos os motores como um organismo inteligente e unificado. Ele traduz os objetivos de vida do usuário em "Missões" acionáveis, gerenciando suas prioridades, dependências e progresso em tempo real.

## Visão Geral da Arquitetura

O Life Orchestrator é composto pelos seguintes motores principais:

1.  **Mission Engine**: Gerencia a criação, quebra em etapas e atualização do estado das missões.
2.  **Priority Engine**: Calcula e resolve conflitos de prioridade entre missões, utilizando dados do Personal DNA e Context Engine.
3.  **Dependency Engine**: Garante que as etapas e missões sejam executadas na ordem correta, identificando bloqueios.
4.  **Orchestrator Runtime**: O núcleo de execução que processa eventos, dispara atualizações em cascata e coordena a interação entre todos os motores do LifeOS.

## Integração Completa com o LifeOS

O Life Orchestrator integra-se profundamente com os seguintes motores para fornecer uma experiência holística e adaptativa:

| Motor Integrado | Função na Orquestração |
|---|---|
| **Life Graph** | Atualiza o progresso de objetivos e metas vinculados às missões. |
| **Context Engine** | Fornece o contexto atual para o cálculo de prioridades e detecção de eventos. |
| **Memory Engine** | Registra eventos e aprendizados importantes para referência futura. |
| **Decision Engine** | Oferece recomendações para a tomada de decisão em momentos críticos da missão. |
| **Action Engine** | Executa ações concretas necessárias para o avanço das etapas da missão. |
| **Future Engine** | Simula cenários, riscos e oportunidades relacionados às missões. |
| **Evolution Engine** | Processa novos dados, atualiza o Personal DNA e a Timeline com base no progresso da missão. |
| **Personal DNA** | Influencia o cálculo de prioridades e a personalização das sugestões. |
| **Life Companion** | Notifica o usuário sobre o progresso, conflitos e sugestões, e atualiza o dashboard. |

## O Conceito de Missões

Uma **Missão** representa um objetivo de vida significativo do usuário (ex: "Comprar uma casa", "Melhorar saúde"). Cada missão é automaticamente quebrada em `MissionStep`s menores e gerenciada com base em:

*   **Objetivo**: O resultado desejado.
*   **Prioridade**: Um valor dinâmico (0-100) calculado pelo Priority Engine.
*   **Estado**: (draft, active, paused, completed, cancelled).
*   **Progresso**: Percentual de conclusão baseado nas etapas.
*   **Riscos e Oportunidades**: Identificados pelo Future Engine e associados à missão.
*   **Dependências**: Outras missões ou etapas que precisam ser concluídas primeiro.

## Sistema de Prioridades Globais e Resolução de Conflitos

O Life Orchestrator mantém um sistema de prioridades globais dinâmico. Quando duas missões entram em conflito (ex: recursos limitados, tempo), o Priority Engine:

1.  **Explica o Motivo**: Detalha por que uma missão tem prioridade sobre a outra (baseado em Personal DNA, contexto, riscos, etc.).
2.  **Sugere Alternativas**: Propõe ações como pausar uma missão, realocar recursos ou ajustar o cronograma para otimizar o progresso geral.

## Event-Driven Orchestration

O sistema é orientado a eventos. Sempre que um evento significativo ocorre (ex: etapa concluída, mudança de contexto, nova informação do Evolution Engine), o Orchestrator Runtime:

*   Atualiza a `Timeline` e o `Contexto`.
*   Dispara atualizações no `Personal DNA` e `Previsões`.
*   Notifica o `Companion` e atualiza o `Dashboard`.
*   Reavalia as prioridades e dependências de todas as missões ativas.

Essa abordagem garante que o LifeOS esteja sempre atualizado e adaptado às necessidades e ao ambiente do usuário, coordenando de forma inteligente todas as suas capacidades para alcançar os objetivos de vida mais importantes.
