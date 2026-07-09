# Life Events Engine

O **Life Events Engine** é um componente inteligente da Life Timeline, dedicado a identificar e analisar marcos significativos na vida do usuário. Diferente de simplesmente registrar eventos, este motor busca padrões, anomalias e pontos de virada que representam mudanças substanciais ou conquistas importantes.

## Objetivo

O principal objetivo do Life Events Engine é:

-   **Detectar Mudanças Significativas:** Identificar períodos ou eventos que alteraram fundamentalmente a rotina, o estado financeiro, a saúde, os relacionamentos ou a carreira do usuário.
-   **Reconhecer Conquistas e Fracassos:** Marcar momentos de sucesso ou insucesso que tiveram um impacto notável.
-   **Analisar Causalidade:** Conectar eventos aparentemente distintos para revelar cadeias de causa e efeito, mostrando como uma mudança levou a outras.
-   **Fornecer Insights:** Ajudar o usuário a compreender a trajetória de sua vida, os fatores que impulsionaram o crescimento ou os desafios que enfrentou.

## Como Funciona

O `LifeEventsEngine` opera sobre o conjunto de `TimelineEntry`s gerenciado pelo `TimelineEngine`, aplicando algoritmos de análise para extrair significado:

1.  **Detecção de Mudanças Maiores (`detect_major_change`):** Este método filtra entradas que são categorizadas como "changes" ou que possuem um `impact_score` elevado (ex: acima de 80). Ele pode ser aprimorado com análise de séries temporais para identificar desvios significativos em métricas chave ao longo do tempo.
2.  **Identificação de Conquistas (`get_achievements`):** Simplesmente filtra entradas com a categoria "achievements", mas pode ser expandido para inferir conquistas a partir de padrões de sucesso em projetos ou objetivos.
3.  **Análise de Causalidade (`analyze_causality`):** Este é um dos aspectos mais inteligentes do motor. Ele busca sequências de eventos relacionados (por `relationships` ou `context`) que ocorrem em proximidade temporal e que possuem um `impact_score` relevante. O exemplo clássico é:
    *   Mudança de emprego (alto impacto)
    *   ↓ (leva a)
    *   Mudança financeira (impacto médio)
    *   ↓ (leva a)
    *   Mudança de rotina (impacto baixo/médio)
    *   ↓ (leva a)
    *   Mudança na saúde (impacto variável)

    A análise de causalidade reconstrói essas narrativas, mostrando ao usuário como um evento inicial pode ter desencadeado uma série de transformações em diferentes áreas da vida.

## Integração com Outros Motores

O Life Events Engine se beneficia da riqueza de dados fornecida por:

-   **Memory Engine:** Para identificar padrões de comportamento e hábitos que podem indicar mudanças.
-   **Context Engine:** Para fornecer o contexto imediato dos eventos.
-   **Decision Engine:** Para entender as decisões que levaram a certos resultados.
-   **Life Graph:** Para correlacionar eventos com o progresso ou desvio de objetivos de longo prazo.

Ao sintetizar essas informações, o Life Events Engine oferece uma visão profunda e significativa da jornada de vida do usuário, transformando um simples registro de eventos em uma narrativa inteligente e compreensível.
