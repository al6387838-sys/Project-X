# Conflict Resolution

O **Conflict Resolver** garante a coesão das decisões geradas pelo sistema. Como as decisões são geradas a partir de diferentes fontes (Life Graph, Context, Memory), é comum que elas entrem em conflito por recursos ou contextos sobrepostos.

## Detecção de Conflitos

O método `detect_conflicts` compara a lista de `affected_context` de todas as decisões. Se houver sobreposição, um objeto `Conflict` é gerado.

A severidade do conflito (1 a 10) é calculada com base na quantidade de contextos sobrepostos e na diferença de prioridade entre as decisões envolvidas.

## Estratégias de Resolução

O motor suporta quatro estratégias de resolução:

1. **`priority_wins` (Padrão):** A decisão com a maior prioridade prevalece. A perdedora é descartada ou rebaixada.
2. **`merge`:** As decisões são mescladas em uma única. Seus contextos afetados e raciocínios são combinados.
3. **`defer`:** Uma das decisões é adiada para ser reavaliada em um ciclo futuro, permitindo que a mais prioritária prossiga agora.
4. **`user_arbitration`:** Para conflitos de severidade muito alta (ex: severidade >= 8), o sistema não toma a decisão automaticamente e escala para intervenção humana.

## Explicabilidade na Resolução

Assim como as decisões, as resoluções de conflito são totalmente explicáveis. Quando um conflito é resolvido, a estratégia utilizada e a justificativa são anexadas ao `reasoning` da decisão vencedora e registradas no objeto `Conflict`.
