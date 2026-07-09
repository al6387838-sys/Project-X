# Decision Engine V1

**Projeto:** PROJECT-X | **Fase:** 3 | **Sprint:** 021

O **Decision Engine** é o núcleo inteligente do LifeOS responsável por transformar contexto e dados do Life Graph em decisões acionáveis, explicáveis e auditáveis. Ele não executa ações diretamente, mas fornece a melhor recomendação possível baseada em um sistema rigoroso de pontuação (Decision Score).

## Responsabilidades Principais

1. **Analisar Contexto:** Extrair e avaliar variáveis do ambiente, como nível de energia, urgência, orçamento e estado emocional.
2. **Avaliar Prioridades:** Calcular pesos dinâmicos baseados no contexto (ex: se o nível de energia está baixo, a conservação de energia ganha prioridade).
3. **Calcular Impacto:** Estimar o impacto positivo e negativo de cada alternativa.
4. **Comparar Alternativas:** Gerar múltiplas opções de ação e pontuá-las através do Decision Score.
5. **Justificar Decisões:** Construir uma cadeia de raciocínio clara que explique *por que* uma decisão foi tomada.
6. **Gerar Recomendações:** Fornecer a ação recomendada final, juntamente com riscos e benefícios esperados.

## Categorias de Decisão

O Decision Engine atua de forma contextualizada nas seguintes áreas da vida do usuário:

| Categoria | Descrição e Foco |
| :--- | :--- |
| **Saúde** | Otimização de sono, energia, exercícios e redução de estresse. |
| **Finanças** | Controle de orçamento, avaliação de riscos financeiros e compras por impulso. |
| **Produtividade** | Gerenciamento de foco, blocos de trabalho profundo e priorização de tarefas. |
| **Relacionamentos** | Resolução de conflitos e manutenção de conexões profissionais e pessoais. |
| **Projetos** | Ajuste de escopo, prazos e alocação de recursos em iniciativas. |
| **Carreira** | Avaliação de oportunidades, negociações e satisfação profissional. |
| **Conhecimento** | Estratégias de aprendizagem, retenção e alocação de tempo para estudos. |

## O Sistema de Decision Score

Toda alternativa avaliada recebe um **Decision Score** de 0 a 100, calculado com base nos seguintes pesos base:

* **Urgência (20%):** O quão crítica é a necessidade de agir imediatamente.
* **Impacto (25%):** O benefício líquido estimado (prós vs contras).
* **Confiança (20%):** A certeza da IA baseada na qualidade e quantidade de dados.
* **Alinhamento com Objetivo (20%):** O quanto a decisão aproxima o usuário de seu objetivo declarado.
* **Cobertura de Contexto (10%):** A quantidade de variáveis consideradas.
* **Bônus de Aprendizagem (5%):** Acréscimo baseado em feedbacks positivos anteriores em decisões semelhantes.

## Fluxo de Execução

1. O sistema recebe um `ContextInput` e um `Goal`.
2. O `DecisionEngineCore` carrega as regras de contexto correspondentes à categoria.
3. Múltiplas alternativas são geradas.
4. O `DecisionScore` avalia cada alternativa.
5. A alternativa com maior pontuação é selecionada como recomendação.
6. A decisão é registrada no `DecisionHistory`.
7. O usuário pode fornecer feedback (aceitar/rejeitar), o que ajusta o *Bônus de Aprendizagem* futuro.

## Exemplo de Decisão Gerada

**Contexto:** Dormiu mal (`sleep_quality: bad`), tem uma reunião importante (`upcoming_event: important_meeting`).

**Recomendação:** Reagendar a reunião importante.

**Justificativa:** "A recomendação 'Reagendar a reunião importante' foi selecionada com Decision Score de 85.0/100 e confiança de 95.0%. O contexto atual indica que esta é a opção com maior impacto positivo e menor risco para o objetivo 'Manter performance cognitiva'."

**Riscos Mitigados:** Pode atrasar o projeto.
**Benefícios Esperados:** Evitar tomar decisões ruins por cansaço, recuperar energia para melhor performance.
