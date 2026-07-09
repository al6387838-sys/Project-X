# Priority Engine

**Project-X | Sprint 013**

O Priority Engine é o componente do Life Orchestrator responsável por calcular, gerenciar e resolver conflitos de prioridade entre as Missões do usuário. Ele garante que o LifeOS sempre foque nos objetivos mais relevantes e impactantes, adaptando-se dinamicamente às mudanças no contexto e no perfil do usuário.

## Como a Prioridade é Calculada

A prioridade de uma missão é um valor dinâmico (0-100) que é recalculado periodicamente ou em resposta a eventos significativos. O Priority Engine considera uma série de fatores para determinar a prioridade, incluindo:

*   **Prioridade Base da Missão**: Definida inicialmente pelo usuário.
*   **Personal DNA**: Valores e traços de personalidade do usuário (ex: missões alinhadas com "família" ou "crescimento de carreira" recebem um boost se esses forem valores centrais do usuário).
*   **Context Engine**: Eventos urgentes, prazos próximos ou mudanças no ambiente que podem impactar a relevância de uma missão.
*   **Future Engine (Riscos e Oportunidades)**: Missões que mitigam riscos de alta severidade ou aproveitam oportunidades de alto ganho potencial podem ter sua prioridade elevada.
*   **Dependências**: Missões que são pré-requisitos para outras missões de alta prioridade podem ter sua prioridade ajustada.

## Resolução de Conflitos de Prioridade

Quando duas ou mais missões competem por recursos (tempo, energia, atenção), o Priority Engine atua para resolver o conflito. Ele não apenas indica qual missão tem maior prioridade, mas também:

*   **Explica o Motivo**: Fornece uma justificativa clara baseada nos fatores de cálculo de prioridade.
*   **Sugere Alternativas**: Propõe ações para o usuário, como:
    *   Focar na missão de maior prioridade.
    *   Pausar temporariamente a missão de menor prioridade.
    *   Reavaliar os recursos ou a estratégia para ambas as missões.
    *   Buscar uma solução que permita o progresso em ambas, se possível.

## Integração com Outros Motores

O Priority Engine interage diretamente com:

*   **Mission Engine**: Para acessar e atualizar as missões e seus atributos.
*   **Personal DNA**: Para entender os valores e preferências do usuário.
*   **Context Engine**: Para obter informações sobre o ambiente e eventos atuais.
*   **Future Engine**: Para incorporar a análise de riscos e oportunidades no cálculo de prioridade.

## Benefícios

Ao manter um sistema de prioridades inteligente e adaptativo, o Priority Engine garante que o LifeOS:

*   **Otimize o Foco**: Ajuda o usuário a concentrar sua energia no que realmente importa.
*   **Minimize Conflitos**: Reduz a sobrecarga de decisões e o estresse causado por objetivos concorrentes.
*   **Maximize o Impacto**: Direciona o esforço para as missões que trarão os maiores benefícios ou evitarão os maiores problemas.

O Priority Engine é essencial para transformar a complexidade da vida em um fluxo de trabalho claro e priorizado, permitindo que o usuário navegue em seus objetivos com clareza e propósito.
