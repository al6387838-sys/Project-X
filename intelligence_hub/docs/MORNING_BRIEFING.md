# Morning Briefing

O **Morning Briefing** é a primeira "experiência mágica" do LifeOS, projetada para fornecer ao usuário um resumo personalizado e contextualizado de seu dia ao acordar. Ele integra informações de todos os motores do sistema para apresentar insights acionáveis e relevantes, respondendo à pergunta "Como consegui viver sem isso?".

## Objetivo

O principal objetivo do Morning Briefing é:

-   **Personalização Extrema:** Cada briefing é único, gerado dinamicamente com base no estado atual do usuário, seus objetivos, contexto e histórico.
-   **Contextualidade:** As informações apresentadas são relevantes para o momento presente, considerando eventos recentes, padrões de sono, conflitos de agenda, etc.
-   **Acionabilidade:** O briefing não apenas informa, mas também sugere ações ou pontos de atenção, como "quick wins" ou conflitos a serem resolvidos.
-   **Explicabilidade:** Cada item do briefing pode ser questionado pelo usuário ("Por que você sugeriu isso?"), e o sistema deve fornecer o raciocínio por trás da sugestão, utilizando o `Reasoning Engine` do Decision Engine.

## Como Funciona

O `MorningBriefing` é gerado pelo `MorningBriefingGenerator`, que utiliza um `IntelligenceEngine` para coletar um *snapshot* consolidado de todos os motores do LifeOS:

1.  **`IntelligenceEngine`:** Orquestra a coleta de dados do Life Graph, Context Engine, Memory Engine, Decision Engine e Action Engine.
2.  **`MorningBriefingGenerator`:** Processa o *snapshot* e constrói a narrativa do briefing, utilizando lógica condicional para adaptar a saudação, destacar prioridades, identificar conflitos, reportar sinais de saúde e energia, resumir o progresso e sugerir "quick wins".
3.  **Explicabilidade:** O método `explain_item` permite que o usuário entenda a origem e o raciocínio de cada informação apresentada no briefing.

## Conteúdo Típico

Um Morning Briefing pode incluir, mas não se limita a:

-   **Saudação Dinâmica:** Adaptada ao estado de saúde ou energia do usuário.
-   **Prioridades Reais:** As decisões mais importantes do dia, vindas do Decision Engine.
-   **Conflitos de Agenda:** Alertas sobre sobreposições ou problemas de agendamento.
-   **Sinais de Saúde/Energia:** Informações sobre qualidade do sono, níveis de estresse, etc.
-   **Progresso de Metas:** Atualização sobre o andamento de objetivos semanais ou de projetos.
-   **Quick Wins:** Sugestões de tarefas rápidas e de alto impacto que podem ser realizadas em pouco tempo.

## Arquitetura para Revisões Futuras

O design do Morning Briefing é a base para outras revisões periódicas, como:

-   **Evening Review:** Resumo do dia e preparação para o próximo.
-   **Weekly Review:** Análise da semana e ajuste de metas.
-   **Monthly Review:** Visão macro de objetivos e crescimento a longo prazo.

Esses fluxos seguirão o mesmo princípio de contextualidade e explicabilidade, adaptando o conteúdo e a profundidade das informações ao período de tempo que estão revisando.
