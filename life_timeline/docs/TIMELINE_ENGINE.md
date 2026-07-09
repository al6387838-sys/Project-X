# Timeline Engine

O **Timeline Engine** é o coração da Life Timeline, responsável por gerenciar o ciclo de vida das `TimelineEntry`s, desde o registro até a recuperação e busca. Ele é projetado para lidar com um volume massivo de dados, garantindo performance e escalabilidade para armazenar e consultar décadas de informações da vida do usuário.

## `TimelineEntry`

O modelo de dados fundamental gerenciado pelo Timeline Engine é o `TimelineEntry`. Cada entrada representa um evento, decisão, objetivo, mudança, etc., na vida do usuário. Seus atributos incluem:

| Atributo | Tipo | Descrição |
|----------|------|-----------|
| `timeline_id` | `str` | Identificador único (UUID) da entrada. |
| `timestamp` | `float` | Momento em que o evento ocorreu ou foi registrado. |
| `title` | `str` | Título conciso do evento. |
| `description` | `str` | Descrição detalhada do evento. |
| `context` | `Dict[str, Any]` | Metadados contextuais (ex: `{'location': 'Paris', 'people': ['Alice']}`). |
| `category` | `str` | Categoria do evento (ex: `projects`, `goals`, `changes`, `events`). |
| `impact_score` | `int` | Pontuação de impacto (0-100) na vida do usuário. |
| `relationships` | `List[str]` | IDs de outras `TimelineEntry`s relacionadas. |
| `metadata` | `Dict[str, Any]` | Dados adicionais e flexíveis. |

## `TimelineIndex`

Para garantir a eficiência na busca e recuperação de dados, o Timeline Engine utiliza um `TimelineIndex`. Este índice mantém referências organizadas às `TimelineEntry`s, permitindo consultas rápidas por diferentes critérios.

### Estrutura do Índice

-   **`by_category`**: Um dicionário que mapeia categorias (ex: "projects", "changes") para listas de `timeline_id`s. Isso permite filtrar rapidamente eventos por tipo.
-   **`by_timestamp`**: Uma lista ordenada de tuplas `(timestamp, timeline_id)`. Utiliza o algoritmo `bisect` para inserções e buscas eficientes baseadas em tempo, crucial para navegação cronológica.
-   **`by_id`**: Um dicionário que mapeia `timeline_id`s diretamente para os objetos `TimelineEntry` completos, permitindo acesso direto a qualquer entrada pelo seu identificador único.

## Funcionalidades Principais

-   **`record_event(...)`**: Registra uma nova `TimelineEntry`, atribuindo um `timeline_id` único, timestamp e indexando-a automaticamente. Este método é o ponto de entrada para a ingestão de dados de todos os outros motores do LifeOS.
-   **`get_entry(entry_id)`**: Recupera uma `TimelineEntry` específica pelo seu `timeline_id`.
-   **`search(...)`**: Permite buscar entradas da timeline utilizando uma combinação de filtros:
    -   `category`: Filtra por uma ou mais categorias.
    -   `start_time`, `end_time`: Filtra por um intervalo de tempo.
    -   `query`: Realiza busca textual no título e descrição das entradas.

## Escalabilidade e Performance

O design do Timeline Engine, com sua indexação otimizada e separação de responsabilidades, é fundamental para suportar o crescimento exponencial de dados ao longo de décadas. A utilização de `bisect` para o índice temporal garante que mesmo com milhões de entradas, a navegação e busca por períodos permaneçam responsivas. A arquitetura modular também permite que futuras otimizações de armazenamento (ex: integração com bancos de dados NoSQL para dados históricos) sejam implementadas sem afetar a lógica central do motor.
