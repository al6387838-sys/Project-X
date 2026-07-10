# Platform Monitor — Guia de Operação

**EXECUTION-005 | PROJECT-X PHASE 5**
**Data:** Julho de 2026

## 1. Propósito

O **Platform Monitor** é o módulo de monitoramento de infraestrutura do LifeOS. Ele rastreia a saúde de cada componente da plataforma — desde microsserviços até recursos de sistema — e contribui para o Platform Health Score (25% do Overall Score).

## 2. Componentes Monitorados

O monitor cobre os seguintes componentes da infraestrutura:

| Componente | Métricas | Limiar de Alerta |
|:---|:---|:---|
| **CPU** | Utilização percentual | > 80% = Warning, > 95% = Critical |
| **Memória** | Utilização percentual | > 70% = Warning, > 85% = Critical |
| **Disco** | Utilização percentual | > 75% = Warning, > 90% = Critical |
| **Latência P50** | Tempo de resposta mediano (ms) | > 100ms = Warning |
| **Latência P95** | Percentil 95 de latência (ms) | > 300ms = Warning, > 500ms = Critical |
| **Latência P99** | Percentil 99 de latência (ms) | > 800ms = Warning, > 1500ms = Critical |
| **Uptime** | Disponibilidade percentual | < 99.9% = Warning, < 99% = Critical |
| **Error Rate** | Taxa de erros percentual | > 1% = Warning, > 5% = Critical |
| **Crash Rate** | Taxa de crashes | > 0.1% = Warning |
| **RPS** | Requisições por segundo | Monitoramento de anomalias |

## 3. Service Monitor

O Service Monitor é a camada de observabilidade individual dos microsserviços. Cada serviço é monitorado com as seguintes métricas:

O **status** indica se o serviço está online, degraded, offline ou em standby. O **uptime percent** mede a disponibilidade do serviço em janelas de 24 horas. A **latência média** é o tempo de resposta médio em milissegundos. A **taxa de erros** é o percentual de requisições que falharam. O **crash count** é o número de crashes nas últimas 24 horas.

Os serviços monitorados atualmente incluem API Gateway, Life Kernel, Intelligence Hub, Action Engine, Database (Primary e Replica), Redis Cache e Object Storage.

## 4. Cálculo do Platform Health Score

O Platform Health Score é calculado a partir de sete métricas normalizadas:

| Métrica | Peso | Fórmula de Normalização |
|:---|:---|:---|
| Uptime | 25% | uptime (já está em 0-100) |
| CPU Health | 15% | max(0, 100 - cpu_usage) |
| Memory Health | 15% | max(0, 100 - memory_usage) |
| Disk Health | 10% | max(0, 100 - disk_usage) |
| Latency Health | 15% | max(0, 100 - (avg_latency / 3)) |
| Error Health | 10% | max(0, 100 - (error_rate × 100)) |
| Crash Health | 10% | max(0, 100 - (crash_rate × 10000)) |

O score final é a soma ponderada das sete métricas, resultando em um valor entre 0 e 100.

## 5. Alertas Automáticos

O Platform Monitor gera alertas automáticos nas seguintes condições:

Quando a CPU ultrapassa 80% de utilização, um alerta de warning é gerado com a mensagem "Queda de Performance — CPU". Se ultrapassar 95%, a severidade sobe para critical. O mesmo padrão se aplica para memória (>70% warning, >85% critical), disco (>75% warning, >90% critical), latência (>300ms P95 warning, >500ms critical) e uptime (<99.9% warning, <99% critical).

Alertas de performance são gerados quando a latência ou uso de recursos indica degradação, com recomendações específicas para cada módulo afetado.

## 6. Recomendações de Performance

O monitor gera recomendações automáticas baseadas no diagnóstico das métricas. As recomendações incluem o módulo alvo, a ação sugerida e o nível de confiança.

Exemplos típicos incluem: "A performance caiu 18% após a última atualização. Sugestão: revisar módulo Decision Engine." "Latência P95 elevada (244ms). Sugestão: implementar caching agressivo no API Gateway." "Memória em 61%. Sugestão: revisar processamento batch no Intelligence Hub."

## 7. Histórico e Tendências

O monitor mantém histórico diário de todas as métricas de plataforma, permitindo visualização de tendências ao longo do tempo. O gráfico de evolução mostra a variação do Platform Health Score nos últimos 30 dias, facilitando a correlação entre releases e degradações de performance.

A tendência é detectada automaticamente comparando a média dos últimos 7 dias com os 7 dias anteriores. Tendências de queda (down) indicam degradação progressiva que requer atenção antes de atingir limiares críticos.

## 8. Estado Atual dos Serviços

| Serviço | Status | Uptime | Latência | Erros | Crashes (24h) |
|:---|:---|:---|:---|:---|:---|
| API Gateway | Online | 100% | 12ms | 0.01% | 0 |
| Life Kernel | Online | 99.9% | 35ms | 0.05% | 0 |
| Intelligence Hub | Online | 99.9% | 312ms | 0.03% | 0 |
| Action Engine | Online | 100% | 89ms | 0.02% | 0 |
| Database (Primary) | Online | 100% | 8ms | 0.01% | 0 |
| Database (Replica) | Online | 100% | 11ms | 0.02% | 0 |
| Redis Cache | Online | 100% | 3ms | 0% | 0 |
| Object Storage | Online | 100% | 45ms | 0.01% | 0 |

## 9. Platform Health Score Atual

O Platform Health Score atual é **77/100** (classificação: BOM), com tendência estável. Os pontos de atenção incluem memória em 61% (saúde 39/100) e latência P95 em 187ms (saúde 62/100). O uptime de 99.94% e a ausência de crashes contribuem positivamente para o score.

---
*LifeOS Platform Monitor — EXECUTION-005 — PROJECT-X PHASE 5 — Sprint 028*
