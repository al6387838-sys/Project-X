# Memory Evolution Engine

O **Memory Evolution Engine** é o motor responsável pela manutenção autônoma, consolidação e degradação natural das memórias do Companion. Ele simula processos neurobiológicos para garantir que o Companion retenha informações úteis enquanto descarta dados irrelevantes.

## 1. O Processo de Consolidação (Memory Consolidation)

Assim como o cérebro humano consolida memórias durante o sono, o Companion possui rotinas de consolidação (`MemoryConsolidation`) que rodam em background.

### Etapas da Consolidação:
1. **Promoção (Promotion):** Memórias de curto prazo (`Short-Term`) que atingem um limite mínimo de acessos (ex: 3 acessos) ou de força (ex: > 0.6) são promovidas para `Long-Term`.
2. **Detecção de Duplicatas:** O motor utiliza similaridade de Jaccard para comparar textos. Se duas memórias são mais de 85% similares, a mais fraca é arquivada e a mais forte recebe um reforço de força, fundindo as tags e entidades de ambas.
3. **Descoberta de Relações:** O motor varre todas as memórias buscando entidades (pessoas, projetos) ou tags em comum. Quando encontra, cria uma `MemoryRelation` automática no grafo, com um peso proporcional à similaridade.
4. **Compressão de Contexto:** Memórias do tipo `Context` que ultrapassaram seu TTL (Time-To-Live) são expurgadas do sistema.

## 2. Envelhecimento e Decaimento (Memory Aging)

Para evitar que o sistema fique sobrecarregado com informações irrelevantes e perca velocidade de recuperação, a Sovereign Memory implementa um sistema de decaimento (Decay).

### A Matemática do Esquecimento
Cada `MemoryNode` possui:
- `strength` (Força): Varia de 0.0 a 1.0.
- `decay_rate` (Taxa de Decaimento): Varia conforme a prioridade da memória.

A cada ciclo de *aging* (geralmente a cada 24 horas), a fórmula aplicada é:
```python
decay_amount = decay_rate * days_elapsed
new_strength = max(0.0, current_strength - decay_amount)
```

**Comportamento por Prioridade:**
- **Critical (Protegidas):** `decay_rate = 0.0` (Nunca decaem).
- **High:** `decay_rate = 0.002` (Decaimento muito lento).
- **Medium:** `decay_rate = 0.01` (Decaimento normal).
- **Low:** `decay_rate = 0.05` (Esquecimento rápido).

Quando a força de uma memória cai abaixo do limiar de arquivamento (`ARCHIVE_THRESHOLD = 0.10`), ela é removida da memória ativa e enviada para o arquivo frio (`Archive`), a menos que o usuário tenha marcado como protegida.

## 3. Priorização Dinâmica (Reprioritization)

O motor reavalia a prioridade das memórias dinamicamente com base em quatro fatores:
1. **Frequência de Acesso:** Quantas vezes o Companion precisou recuperar essa memória (peso 30%).
2. **Força Atual:** A força remanescente após o decaimento (peso 30%).
3. **Centralidade:** Quão conectada a memória está no *Memory Graph* (peso 20%).
4. **Reforço:** Quantas vezes o usuário confirmou ou interagiu positivamente com a memória (peso 20%).

Memórias com score alto são promovidas para `Priority.HIGH`, enquanto memórias não utilizadas caem para `Priority.LOW`.

## 4. Recuperação Contextual (Recall)

Quando o Companion precisa formular uma resposta, ele não faz uma busca burra. O método `recall()` do motor:
1. Busca memórias semanticamente e textualmente relevantes.
2. Filtra por domínios ou entidades envolvidas.
3. **Gera Justificativas:** Para cada memória recuperada, o motor anexa o motivo pelo qual ela foi trazida à tona (ex: "acessada 12x", "envolve a entidade Ana", "alta prioridade consolidada").
4. Injeta a memória de trabalho atual (`Working Memory`) para garantir fluidez conversacional.

---
*Documentação gerada automaticamente para a fase EXECUTION-006.*
