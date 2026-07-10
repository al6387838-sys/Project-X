# Memory Graph

O **Memory Graph** é a estrutura de dados topológica que permite ao Companion "pensar por associação". Em vez de tratar memórias como registros isolados em um banco de dados relacional, o sistema trata cada memória como um nó em um grafo complexo e direcionado.

## 1. Estrutura do Grafo

- **Vértices (Nós):** São os objetos `MemoryNode`. Representam conceitos, pessoas, preferências, eventos ou episódios.
- **Arestas (Relações):** São os objetos `MemoryRelation`. Representam como duas memórias se conectam.

### Tipos de Relação (`RelationType`)
O sistema suporta relações ricas e tipadas:
- `CAUSES` / `CAUSED_BY`: Relações de causalidade.
- `RELATED_TO`: Relação semântica genérica.
- `SIMILAR_TO`: Nós com conteúdo parecido (usado para fusão).
- `INVOLVES_PERSON` / `INVOLVES_PROJECT`: Relações de entidade.
- `PRECEDES` / `FOLLOWS`: Relações cronológicas.
- `CONTRADICTS` / `CONFIRMS`: Relações lógicas (úteis para resolução de conflitos).
- `DUPLICATE_OF`: Marca ponteiros para memórias que foram mescladas.

## 2. Operações no Grafo

O `MemoryGraph` implementa algoritmos clássicos de teoria dos grafos adaptados para cognição artificial:

### Busca em Largura (BFS - Breadth-First Search)
Quando o Companion precisa entender o contexto profundo de um tópico, ele inicia uma BFS a partir do nó central da conversa. Isso permite que ele recupere não apenas a memória exata, mas as memórias adjacentes (ex: ao falar sobre o projeto X, ele lembra automaticamente das pessoas associadas ao projeto X).

### Centralidade (Degree Centrality)
O algoritmo de centralidade calcula quais memórias são as mais importantes no "cérebro" do Companion.
Nós com muitas conexões de entrada e saída (ex: o nome do usuário, ou o projeto principal em que ele trabalha) recebem um score alto de centralidade. Essas memórias ganham resistência extra contra o decaimento (aging).

### Detecção de Clusters (Componentes Conectados)
O grafo consegue identificar "ilhas" de conhecimento. Por exemplo, todas as memórias relacionadas à vida pessoal podem formar um cluster, enquanto as relacionadas ao trabalho formam outro. Isso ajuda o Companion a ajustar seu tom e contexto dependendo do cluster em que a conversa atual está navegando.

## 3. Visualização e Exportação

O Memory Graph não é uma caixa preta. A classe `MemoryGraph` possui métodos nativos para:
- **Exportação para UI:** O método `get_graph_data()` formata nós e arestas para renderização no front-end usando bibliotecas visuais (como D3.js ou vis.js no *Memory Center*).
- **Exportação para Documentação:** O método `to_mermaid()` converte a topologia das memórias mais fortes diretamente em sintaxe Mermaid.js, permitindo a renderização de diagramas em arquivos Markdown.

---
*Documentação gerada automaticamente para a fase EXECUTION-006.*
