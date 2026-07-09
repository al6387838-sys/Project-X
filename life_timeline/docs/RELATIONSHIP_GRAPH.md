# Relationship Graph

O **Relationship Graph**, gerenciado pelo `RelationshipMapper`, é a funcionalidade da Life Timeline que transforma uma coleção de eventos isolados em uma rede interconectada de experiências. Ele vai além da simples ordenação cronológica, revelando as ligações e influências entre diferentes aspectos da vida do usuário.

## Objetivo

O principal objetivo do Relationship Graph é:

-   **Conectar Eventos:** Identificar e estabelecer ligações entre `TimelineEntry`s que compartilham contexto, entidades ou causalidade.
-   **Visualizar Influências:** Permitir que o usuário veja como uma decisão ou evento em uma área da vida pode ter impactado outras áreas.
-   **Reconstruir Narrativas:** Ajudar a construir uma narrativa mais rica e compreensível da vida, mostrando as teias de relacionamentos que formam a história pessoal.
-   **Suportar Análise Causal:** Fornecer a base para o `LifeEventsEngine` identificar cadeias de causalidade e momentos de virada.

## Como Funciona: O `RelationshipMapper`

O `RelationshipMapper` é o módulo responsável por criar e gerenciar essas conexões. Ele opera de forma inteligente, buscando padrões e correspondências entre as `TimelineEntry`s.

### Mecanismos de Conexão

1.  **Conexão Explícita (`connect_entries`):** Permite criar uma ligação direta entre duas entradas, estabelecendo uma relação bidirecional. Isso pode ser usado quando o sistema ou o usuário identifica uma conexão clara.
2.  **Mapeamento Automático (`auto_map_relationships`):** Esta é a funcionalidade central que torna o Relationship Graph inteligente. Ao registrar uma nova `TimelineEntry`, o `RelationshipMapper` a compara com as entradas existentes para identificar relações potenciais com base em:
    *   **Entidades Compartilhadas:** Se duas entradas mencionam as mesmas pessoas, locais, projetos ou objetivos, elas são consideradas relacionadas.
    *   **Contexto Similar:** Análise de metadados e palavras-chave no `context` das entradas para encontrar semelhanças.
    *   **Proximidade Temporal:** Eventos que ocorrem em um curto espaço de tempo podem ter uma relação causal ou contextual.
    *   **Causalidade Inferida:** Embora mais complexo, o sistema pode inferir causalidade se uma decisão ou ação leva a um resultado que é registrado como um novo evento.

### Representação dos Relacionamentos

Cada `TimelineEntry` armazena uma lista de `timeline_id`s de outras entradas com as quais está relacionada. Isso forma uma estrutura de grafo, onde cada entrada é um nó e cada relacionamento é uma aresta.

### Visualização do Grafo (`get_relationship_graph`)

O `RelationshipMapper` pode fornecer uma representação do grafo de relacionamentos para uma `TimelineEntry` específica. Isso permite que o `HistoryViewer` visualize as conexões de forma intuitiva, mostrando ao usuário a rede de eventos que cercam um ponto específico em sua vida.

## Impacto na Experiência do Usuário

O Relationship Graph eleva a Life Timeline de um simples registro para uma ferramenta de autoconhecimento. Ao visualizar as conexões, o usuário pode:

-   Entender melhor as consequências de suas decisões.
-   Identificar padrões de comportamento e suas causas.
-   Reconhecer a interdependência de diferentes áreas de sua vida.
-   Obter uma perspectiva mais profunda sobre sua jornada pessoal e evolução.

Esta funcionalidade é crucial para a promessa do LifeOS de ser uma "reconstrução inteligente da vida", onde o todo é maior que a soma das partes.
