# LifeOS Cache System Architecture

## Visão Geral

O sistema de cache do LifeOS, introduzido no Sprint 027, é o principal responsável por garantir as metas agressivas de latência (< 500ms para dashboard, < 300ms para Life Graph).

## Taxonomia de Caches

O `CacheManager` orquestra cinco subsistemas especializados:

### 1. Memory Cache (L1)
- **Tipo**: LRU (Least Recently Used) em memória local do processo.
- **Uso**: Dados altamente acessados e de vida curta (ex: configurações de sessão, metadados de UI).
- **Desempenho**: Latência < 0.05ms.

### 2. Redis Cache (L2)
- **Tipo**: Armazenamento chave-valor distribuído.
- **Uso**: Estado compartilhado entre instâncias (sessões, rate limiting, pub/sub).
- **Fallback Gracioso**: Se o Redis falhar, o sistema reverte para o banco de dados sem indisponibilidade (apenas degradação de performance).

### 3. Graph Cache
- **Tipo**: Estrutura otimizada para grafos.
- **Uso**: Cache de sub-grafos do Life Graph do usuário.
- **Vantagem**: Evita travessias recursivas (JOINs complexos) no banco de dados relacional.

### 4. Context Cache
- **Tipo**: Buffer circular.
- **Uso**: Mantém o contexto conversacional do AI Companion.
- **Vantagem**: Reduz o custo de tokens e latência de re-contextualização em chamadas LLM.

### 5. Timeline Cache
- **Tipo**: Time-series cache.
- **Uso**: Otimizado para consultas baseadas em intervalos de tempo (ex: "eventos desta semana").

## Estratégias de Invalidação

- **TTL (Time-To-Live)**: Padrão de 5 a 60 minutos dependendo do domínio.
- **Write-Through**: Atualizações no banco de dados atualizam o cache imediatamente.
- **Lazy Eviction**: Itens expirados são removidos sob demanda para não travar a thread principal.

## Resultados de Eficácia (Sprint 027)

Nos testes de carga, o sistema de cache demonstrou uma **Hit Rate de 67.1%**, permitindo uma vazão de mais de **112.000 operações por segundo (ops/s)** na leitura de cache, absorvendo mais de 2/3 da carga que iria para o banco de dados.
