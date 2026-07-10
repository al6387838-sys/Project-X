# Company Dashboard

O **Company Dashboard** é o painel consolidado do *Autonomous Company System* da LifeOS. Ele foi projetado para fornecer uma visão panorâmica, unificada e em tempo real da saúde geral da empresa, agregando métricas de diversas áreas em um único local.

Este painel atua como a "tela inicial" da operação da empresa, permitindo que líderes e gestores compreendam rapidamente o estado do negócio sem precisarem investigar múltiplos sistemas ou relatórios fragmentados.

## Arquitetura do Dashboard

O Company Dashboard é construído sobre a arquitetura de *Health Scores*, que divide a operação da empresa em cinco pilares fundamentais. Cada pilar é avaliado de forma independente, mas seus resultados convergem para um *Company Health Snapshot*, que dita o score global da organização.

O painel é alimentado por um motor de monitoramento contínuo (`AutoMonitor`), que coleta métricas e avalia regras predefinidas para identificar anomalias, garantindo que o dashboard reflita não apenas os dados estáticos, mas também alertas operacionais.

### Pilares de Monitoramento

| Pilar | Peso no Score Global | Foco Principal | Métricas-Chave |
|---|---|---|---|
| **Negócio** | 30% | Saúde financeira e sustentabilidade | MRR Growth, LTV/CAC, Churn Mensal, Runway |
| **Crescimento** | 25% | Aquisição, ativação e expansão | Signup Growth, Activation Rate, K-Factor, Expansion MRR |
| **Produto** | 20% | Qualidade e adoção de funcionalidades | NPS, Feature Adoption, Bug Rate, Stickiness (DAU/MAU) |
| **Clientes** | 15% | Retenção, satisfação e suporte | D30 Retention, CSAT, Support SLA, Churn Risk |
| **Plataforma** | 10% | Infraestrutura e segurança | Uptime, P95 Latency, Error Rate, Security Score |

## Componentes Principais

O Company Dashboard estrutura a visualização em três componentes principais:

1. **Company Health Scorecard**: Apresenta o score geral (0 a 100) e o status consolidado (Critical, Warning, Fair, Good, Excellent). Ele detalha o desempenho individual de cada um dos cinco pilares, permitindo identificar imediatamente qual área está puxando o score global para cima ou para baixo.
2. **Top KPIs**: Destaca as métricas mais importantes da empresa (MRR, Novos Usuários, Retenção D30, Uptime, etc.), indicando a tendência atual (crescimento, queda ou estabilidade) e se essa tendência é positiva ou negativa para o negócio.
3. **Alertas Ativos**: Integra-se ao sistema de alertas para exibir notificações críticas ou de atenção que exigem ação imediata, garantindo que problemas operacionais não passem despercebidos em meio aos números agregados.

## Integração Operacional

O Company Dashboard não opera isoladamente. Ele atua como o ponto de entrada para visões mais especializadas. A partir dele, executivos podem aprofundar-se no **Executive Dashboard** (focado em investidores e C-level) ou no **Operational Dashboard** (focado em times técnicos e de suporte).

Além disso, os dados que alimentam este painel são os mesmos utilizados pelo `ReportEngine` para gerar relatórios automáticos (diários, semanais, mensais), garantindo total consistência de dados em toda a organização.
