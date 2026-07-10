# CEO Dashboard

O **CEO Dashboard** é a visão executiva máxima do *Autonomous Company System* da LifeOS. Projetado especificamente para o Chief Executive Officer e fundadores, este painel consolida absolutamente todas as métricas vitais da empresa em uma única interface orientada à tomada de decisão estratégica.

Enquanto o *Company Dashboard* oferece uma visão geral de saúde e o *Operational Dashboard* foca em infraestrutura, o CEO Dashboard cruza dados financeiros, de usuários, de produto e metas estratégicas (OKRs) para responder à pergunta fundamental: *"A empresa está na direção certa?"*

## Estrutura de Dados (CEODashboardData)

O dashboard é alimentado por um modelo de dados robusto (`CEODashboardData`) que consolida dezenas de métricas brutas em agrupamentos lógicos. O painel processa esses dados para calcular tendências (crescimento ou queda em relação ao período anterior) e determinar se essas variações são positivas ou negativas para o negócio.

### Agrupamentos Estratégicos

O painel organiza a visão da empresa nas seguintes áreas:

| Área | Métricas Acompanhadas | Foco Estratégico |
|---|---|---|
| **Receita (Revenue)** | MRR, ARR, Net New MRR, Expansion MRR, Churned MRR, Gross Margin | Sustentabilidade financeira e velocidade de expansão. |
| **Usuários (Users)** | Total Users, Novos Usuários (30d), DAU, MAU, Stickiness (DAU/MAU) | Tamanho da base e nível de engajamento diário/mensal. |
| **Retenção (Retention)** | Retenção D30, Churn Mensal, Churn Anual, Usuários em Risco | Capacidade de manter os clientes adquiridos a longo prazo. |
| **Unit Economics** | LTV, CAC, LTV/CAC Ratio, ARPU, Payback Months | Eficiência de capital e rentabilidade por cliente. |
| **Satisfação** | NPS, CSAT | Percepção de valor e lealdade do cliente. |
| **Plataforma** | Uptime, Latência P95, Taxa de Erros, Incidentes (30d) | Confiabilidade técnica e qualidade da entrega do serviço. |
| **Crescimento (Growth)** | K-Factor (Viralidade), Taxa de Ativação, Conversão Visitante-Cadastro | Eficiência do funil e potencial de crescimento orgânico. |

## Funcionalidades Principais

### 1. Visão Completa (Full View)
O método principal do dashboard consolida todos os agrupamentos acima, além de incorporar o **Company Health Snapshot** (os cinco scores de saúde da empresa) e a lista de **Alertas Ativos**. Isso permite que o CEO veja os números brutos e, imediatamente ao lado, a interpretação do sistema sobre a gravidade desses números.

### 2. Acompanhamento de OKRs
O CEO Dashboard integra-se nativamente ao `OKRTracker`. Ele exibe o ciclo ativo atual, o progresso geral ponderado da empresa e o status dos objetivos estratégicos. Isso garante que a liderança não olhe apenas para métricas operacionais, mas também para o avanço das metas trimestrais ou anuais.

### 3. Análise de Tendências de KPIs
O painel extrai os 10 KPIs mais críticos (MRR, Retenção, NPS, LTV/CAC, etc.) e calcula automaticamente a tendência percentual em relação ao ciclo anterior. O sistema entende a semântica de cada métrica: um aumento no MRR é marcado como positivo, enquanto um aumento no Churn é marcado como negativo, facilitando a leitura rápida.

### 4. Geração de Relatórios
O dashboard atua como interface para o `ReportEngine`, permitindo a geração instantânea de relatórios textuais (Diários, Semanais, Mensais) formatados e prontos para distribuição ao board de investidores ou para a comunicação interna (All-Hands).
