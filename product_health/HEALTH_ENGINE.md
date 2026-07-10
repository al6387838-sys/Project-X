# Health Engine — Arquitetura e Design

**EXECUTION-005 | PROJECT-X PHASE 5**
**Data:** Julho de 2026

## 1. Conceito

A **Health Engine** é o motor base do sistema de Inteligência de Saúde do LifeOS. Ela fornece as classes fundamentais para cálculo de scores, geração de alertas e produção de recomendações automáticas. Todas as engines específicas (Product, Platform, AI, SIG) herdam desta base.

## 2. Classes Fundamentais

### HealthScore

A classe `HealthScore` representa o resultado do cálculo de saúde de um domínio. Ela contém o score final (0-100), a tendência detectada, as métricas componentes que compõem o score e a classificação textual (EXCELENTE, BOM, REGULAR, ATENÇÃO, CRÍTICO).

| Campo | Tipo | Descrição |
|:---|:---|:---|
| `domain` | HealthDomain | Domínio do score (product, platform, ai, sig, business, security) |
| `score` | float | Valor final do score (0-100) |
| `trend` | str | Tendência detectada (up, down, stable) |
| `components` | dict | Métricas individuais que compõem o score |

### HealthAlert

A classe `HealthAlert` representa um alerta gerado quando uma métrica cruza um limiar. Alertas são classificados por severidade e associados a um domínio e métrica específica.

| Campo | Tipo | Descrição |
|:---|:---|:---|
| `alert_id` | str | Identificador único do alerta |
| `domain` | HealthDomain | Domínio de origem |
| `severity` | Severity | Severidade (critical, warning, info) |
| `title` | str | Título descritivo do alerta |
| `message` | str | Mensagem detalhada |
| `metric_name` | str | Nome da métrica que triggerou o alerta |
| `metric_value` | str | Valor atual da métrica |
| `threshold` | str | Limiar que foi cruzado |

### HealthRecommendation

A classe `HealthRecommendation` representa uma sugestão automática de ação gerada pelo sistema quando detecta degradação.

| Campo | Tipo | Descrição |
|:---|:---|:---|
| `rec_id` | str | Identificador único da recomendação |
| `domain` | HealthDomain | Domínio de origem |
| `priority` | int | Prioridade (1 = urgente, 2 = alta, 3 = média) |
| `title` | str | Título da recomendação |
| `description` | str | Descrição do problema |
| `suggested_action` | str | Ação sugerida para resolução |
| `module` | str | Módulo alvo da intervenção |
| `confidence` | float | Nível de confiança (0-1) |

### HealthSnapshot

O `HealthSnapshot` é uma captura instantânea de todos os scores, alertas e recomendações em um momento específico. Ele é o formato de saída principal do orquestrador e serve como input para o dashboard.

| Campo | Tipo | Descrição |
|:---|:---|:---|
| `timestamp` | datetime | Momento da captura |
| `overall_score` | float | Score consolidado (média ponderada) |
| `product_score` | HealthScore | Score do produto |
| `platform_score` | HealthScore | Score da plataforma |
| `ai_score` | HealthScore | Score da IA |
| `sig_score` | HealthScore | Score do SIG |
| `business_score` | HealthScore | Score de negócio |
| `security_score` | HealthScore | Score de segurança |
| `alerts` | list | Lista de alertas ativos |
| `recommendations` | list | Lista de recomendações |

## 3. Algoritmo de Cálculo de Score

O cálculo de cada Health Score segue um padrão consistente:

**Etapa 1 — Normalização.** Cada métrica bruta é normalizada para a escala 0-100. Métricas inversas (como latência) são invertidas para que valores maiores signifiquem saúde melhor.

**Etapa 2 — Ponderação.** As métricas normalizadas são ponderadas conforme sua importância relativa para o domínio. O somatório das ponderações sempre resulta em 1.0.

**Etapa 3 — Agregação.** O score final é o somatório ponderado: `score = Σ(métrica_i × peso_i)`.

**Etapa 4 — Classificação.** O score é classificado em cinco faixas: EXCELENTE (≥90), BOM (≥75), REGULAR (≥60), ATENÇÃO (≥40), CRÍTICO (<40).

**Etapa 5 — Tendência.** A tendência é detectada comparando os últimos 7 scores históricos. Se a média recente é superior à anterior, a tendência é "up". Se inferior, "down". Caso contrário, "stable".

## 4. Algoritmo de Geração de Alertas

Os alertas são gerados automaticamente quando uma métrica cruza um limiar definido na engine. O processo inclui:

O sistema verifica cada métrica contra seu threshold. Quando o threshold é cruzado, um alerta é gerado com severidade apropriada. Alertas críticos são gerados para valores em zona de risco iminente, warnings para degradação moderada e infos para contexto relevante.

Os alertas são acumulados em memória e truncados para os últimos 20 por engine, prevenindo consumo excessivo de memória.

## 5. Algoritmo de Geração de Recomendações

As recomendações são geradas condicionalmente com base no estado das métricas. Cada engine define regras específicas para seu domínio.

Quando uma métrica está abaixo de um limiar crítico, uma recomendação é gerada com o título do problema, descrição contextualizada com valores numéricos, ação sugerida com referência ao módulo específico, e nível de confiança estimado.

As recomendações são ordenadas por prioridade no dashboard, com as urgentes (priority 1) destacadas visualmente.

## 6. Extensibilidade

O design da Health Engine é extensível por natureza. Para adicionar um novo domínio de saúde, basta:

Criar uma nova classe que herda do padrão estabelecido, definir as métricas relevantes, seus pesos e thresholds de alerta. Registrar o novo domínio no orquestrador e adicionar uma página correspondente no dashboard.

Este padrão permite que o sistema evolua organicamente sem refatorações significativas.

## 7. Arquivos do Motor

| Arquivo | Classe Principal | Responsabilidade |
|:---|:---|:---|
| `engines/health_engine.py` | HealthEngine | Classes base e algoritmos centrais |
| `engines/product_health_engine.py` | ProductHealthEngine | Avaliação de qualidade do produto |
| `engines/platform_health_engine.py` | PlatformHealthEngine | Monitoramento de infraestrutura |
| `engines/service_monitor.py` | ServiceMonitor | Status individual de microsserviços |
| `engines/ai_health_monitor.py` | AIHealthMonitor | Saúde dos modelos de IA |
| `engines/sig_health_monitor.py` | SIGHealthMonitor | Saúde do Sistema de Inteligência Global |
| `engines/business_security_score.py` | BusinessHealthScore | Métricas de negócio |
| `engines/business_security_score.py` | SecurityHealthScore | Métricas de segurança |
| `orchestrator.py` | ProductHealthOrchestrator | Coordenação e persistência |

---
*LifeOS Health Engine — EXECUTION-005 — PROJECT-X PHASE 5 — Sprint 028*
