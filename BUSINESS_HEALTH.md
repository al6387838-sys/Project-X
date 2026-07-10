# Business Health Score

O **Business Health Score** é o pilar central da avaliação financeira e de sustentabilidade da LifeOS dentro do *Autonomous Company System*. Ele quantifica a viabilidade econômica do negócio em tempo real, combinando métricas de crescimento, eficiência de capital e retenção de receita.

Diferente de métricas isoladas (como olhar apenas para o MRR), o Business Health Score fornece uma visão balanceada, penalizando o crescimento a qualquer custo se ele vier acompanhado de alto churn ou queima excessiva de caixa.

## Metodologia de Cálculo

O score é calculado em uma escala de 0 a 100, onde valores mais altos indicam maior robustez financeira. O cálculo é uma média ponderada de quatro componentes críticos, cada um avaliado contra benchmarks de mercado para empresas SaaS.

### Componentes e Pesos

| Componente | Peso | Benchmark (100 pts) | Impacto no Negócio |
|---|---|---|---|
| **MRR Growth (MoM)** | 30% | 15% de crescimento mensal | Indica a velocidade de expansão da receita recorrente. |
| **LTV/CAC Ratio** | 25% | 3.0x ou superior | Mede a eficiência da aquisição de clientes. Um valor abaixo de 1.0 significa prejuízo por cliente. |
| **Monthly Churn Rate** | 25% | Menor que 2% | Avalia a retenção de receita. Churn alto (acima de 10%) zera este componente. |
| **Runway** | 20% | 18 meses ou mais | Representa a sobrevida financeira da empresa com o caixa e a queima (burn rate) atuais. |

### Lógica de Pontuação

Cada componente é normalizado para uma escala de 0 a 100 antes da ponderação:

*   **MRR Growth**: A pontuação é proporcional ao crescimento, atingindo o máximo em 15% MoM.
*   **LTV/CAC**: Atinge pontuação máxima quando o retorno é 3 vezes o custo de aquisição.
*   **Churn**: Possui uma escala invertida. Churn abaixo de 2% garante pontuação máxima. O score decai linearmente até zerar se o churn ultrapassar 10%.
*   **Runway**: A pontuação cresce linearmente até atingir 100 pontos com 18 meses de caixa garantido.

## Status de Saúde

Com base no score final ponderado, o Business Health Score é classificado em cinco categorias de status, que orientam o nível de urgência das ações gerenciais:

*   **EXCELLENT (90-100)**: Finanças extremamente saudáveis. Crescimento acelerado com alta eficiência e baixo churn.
*   **GOOD (75-89)**: Negócio sólido e sustentável. Operação dentro dos padrões esperados para SaaS.
*   **FAIR (60-74)**: Estável, mas requer atenção. Possível lentidão no crescimento ou leve aumento no custo de aquisição.
*   **WARNING (40-59)**: Sinais de alerta financeiro. Churn elevado, LTV/CAC baixo ou runway encurtando. Exige revisão estratégica.
*   **CRITICAL (0-39)**: Risco existencial. Queima de caixa insustentável, perda massiva de clientes ou crescimento negativo. Exige intervenção imediata.

## Integração com Alertas

O Business Health Score está profundamente integrado ao motor de monitoramento (`AutoMonitor`). Se o status cair para **WARNING** ou **CRITICAL**, o sistema gera automaticamente alertas de alta severidade (AlertType.PRODUCT/REVENUE), notificando os executivos e sugerindo ações corretivas imediatas, como a revisão de campanhas de marketing ou a investigação profunda dos motivos de cancelamento.
