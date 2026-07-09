# Decision Engine — Visão Geral (SPRINT 004)

O **Decision Engine** é o núcleo de tomada de decisão do **PROJECT-X**. Ele transforma o contexto (proveniente do Context Engine), memórias (do Memory Engine) e o estado dos objetivos (do Life Graph) em decisões inteligentes, estruturadas e explicáveis.

## Princípios Arquiteturais

1. **Separação de Preocupações:** O Decision Engine *não* executa ações; ele apenas gera, prioriza e recomenda decisões. A execução fica a cargo de motores subsequentes.
2. **Explicabilidade Total:** A IA nunca responde "Porque sim". Toda decisão gerada possui uma cadeia de raciocínio detalhada e rastreável.
3. **Modularidade:** A arquitetura é dividida em motores independentes: `PriorityEngine`, `ReasoningEngine`, `PredictionEngine`, `RecommendationEngine` e `ConflictResolver`.

## Fluxo de Processamento

1. **Ingestão de Contexto (`ContextInput`):** O motor recebe um snapshot dos dados combinados (Life Graph, Context e Memory).
2. **Geração Bruta (`_generate_decisions`):** Decisões preliminares são criadas baseadas em objetivos ativos, eventos recentes e padrões comportamentais.
3. **Priorização (`PriorityEngine`):** As decisões são avaliadas quanto à urgência, impacto e confiança, recebendo um score de 0 a 100.
4. **Resolução de Conflitos (`ConflictResolver`):** O sistema detecta sobreposições de contexto entre decisões e aplica estratégias de resolução (ex: a maior prioridade vence).
5. **Raciocínio (`ReasoningEngine`):** Cada decisão recebe uma cadeia de raciocínio explícita, detalhando o porquê de ter sido gerada.
6. **Saída:** Uma lista ordenada de objetos `Decision` é disponibilizada, juntamente com `Recommendation` e `Prediction` opcionais.

## Motores Auxiliares

| Motor | Responsabilidade Principal |
|-------|----------------------------|
| **Priority Engine** | Calcular score (0-100) baseado em urgência, impacto e sinais de contexto. |
| **Reasoning Engine** | Construir a `ReasoningChain` e garantir que a decisão seja explicável. |
| **Prediction Engine** | Antecipar estados futuros baseados em histórico e padrões. |
| **Recommendation Engine** | Sintetizar decisões e predições em recomendações acionáveis. |
| **Conflict Resolver** | Detectar e resolver conflitos de contexto entre múltiplas decisões. |

---
*Documento gerado automaticamente durante o SPRINT 004 do PROJECT-X.*
