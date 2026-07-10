# Sistema de Retenção LifeOS

A retenção é a métrica mais crítica para o crescimento sustentável da LifeOS. O Retention Dashboard e seus motores associados fornecem visibilidade completa sobre a saúde da base de usuários, permitindo intervenções proativas antes que o abandono ocorra.

## Análise de Coorte e Engajamento

O sistema acompanha a retenção através de análises de coorte rigorosas, medindo o retorno dos usuários em intervalos padronizados de 1, 3, 7, 14, 30, 60 e 90 dias após o cadastro. Essa abordagem permite identificar exatamente onde o engajamento começa a cair. Além disso, o motor analisa métricas profundas de uso, como a duração média das sessões e a quantidade de funcionalidades distintas exploradas por cada usuário.

| Métrica de Retenção | Descrição e Benchmark | Ação do Sistema |
| :--- | :--- | :--- |
| **Retenção D1** | Retorno no dia seguinte ao cadastro. | Aciona emails de boas-vindas se não houver retorno. |
| **Retenção D7** | Estabelecimento de hábito inicial. | Verifica conclusão do Activation Checklist. |
| **Retenção D30** | Indicador primário de saúde (Benchmark: 25%). | Base para o cálculo do Health Score geral. |
| **Stickiness (DAU/MAU)** | Frequência de uso mensal. | Identifica os usuários mais engajados (power users). |

## Gestão de Churn e Usuários em Risco

A plataforma não apenas mede o churn histórico, mas tenta prevê-lo. Usuários são classificados em diferentes categorias de risco com base em seu comportamento recente.

**Usuários em Risco** são aqueles que reduziram drasticamente sua frequência de uso ou não realizam login há mais de 10 dias. O sistema identifica essas contas e pode acionar campanhas de reengajamento automatizadas.

**Usuários Dormentes** são contas inativas por mais de 30 dias. Para estes, o foco muda de engajamento diário para campanhas de reativação de longo prazo.

O *Health Score* da base é calculado continuamente, combinando a retenção D30, taxas de churn mensal e métricas financeiras como a relação LTV/CAC, classificando a saúde geral do negócio de "Excelente" a "Requer Atenção".
