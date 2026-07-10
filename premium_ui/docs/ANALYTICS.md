# Analytics Engine do LifeOS

## Visão Geral

O Analytics Engine do LifeOS é responsável por processar os dados brutos de telemetria e transformá-los em métricas acionáveis, fornecendo insights sobre o comportamento do usuário, engajamento e a saúde geral da aplicação. Ele é construído para ser flexível e extensível, permitindo o cálculo de uma variedade de indicadores chave de performance (KPIs).

## Componentes Principais

### Analytics Engine (`analytics-engine.js`)

O `AnalyticsEngine` é o módulo que agrega e calcula as métricas a partir dos eventos registrados pelo `TelemetryEngine`. Ele mantém um estado interno (`analyticsData`) que armazena:

- `dailyActiveUsers`: Registro de usuários ativos por dia.
- `sessionData`: Detalhes de cada sessão de usuário, incluindo duração e funcionalidades utilizadas.
- `featureUsage`: Contagem de uso de cada funcionalidade.
- `taskCompletions`: Estatísticas de conclusão de tarefas.
- `userRetention`: Dados para cálculo de retenção.
- `crashes`: Registro de crashes (para cálculo da taxa de crash).
- `performance`: Métricas de performance da aplicação.

## Métricas Calculadas

O `AnalyticsEngine` fornece uma série de funções para calcular métricas importantes:

- **DAU (Daily Active Users)**: Número de usuários únicos que interagiram com a aplicação em um determinado dia.
- **WAU (Weekly Active Users)**: Número de usuários únicos que interagiram com a aplicação em uma determinada semana.
- **MAU (Monthly Active Users)**: Número de usuários únicos que interagiram com a aplicação em um determinado mês.
- **Retention D1, D7, D30**: Percentual de usuários que retornam à aplicação 1, 7 ou 30 dias após sua primeira sessão.
- **Session Time**: Tempo médio que os usuários passam em uma sessão.
- **Feature Usage**: Contagem de quantas vezes cada funcionalidade foi utilizada.
- **Task Completion**: Taxa de sucesso na conclusão de tarefas específicas dentro da aplicação.
- **Crash Rate**: Percentual de sessões que resultaram em um crash.
- **Performance Metrics**: Métricas como tempo médio de carregamento, FCP, LCP, CLS (First Contentful Paint, Largest Contentful Paint, Cumulative Layout Shift).

## Integração com Outros Componentes

O `AnalyticsEngine` é um consumidor dos dados gerados pelo `TelemetryEngine` e fornece os dados processados para o `Admin Dashboard`:

- **Telemetry Engine**: O `TelemetryEngine` envia eventos brutos (page views, clicks, feature usage, errors) que são então processados e agregados pelo `AnalyticsEngine`.
- **Admin Dashboard**: O `Admin Dashboard` utiliza as funções do `AnalyticsEngine` (e.g., `getSummary()`, `getTopFeatures()`) para exibir as métricas de forma visual e compreensível para a equipe de desenvolvimento e gerenciamento do produto.

## Uso e Acesso às Métricas

Para utilizar o `AnalyticsEngine`, ele deve ser inicializado e os dados de telemetria devem ser alimentados através do `TelemetryEngine`. As métricas podem ser acessadas através de suas funções públicas:

```javascript
// Inicialização (já ocorre automaticamente ao carregar o script)
// window.LifeOSAnalytics.init();

// Obter um resumo das métricas
const summary = window.LifeOSAnalytics.getSummary();
console.log("DAU:", summary.dau);
console.log("Retenção D7:", summary.retentionD7);

// Obter as 5 funcionalidades mais usadas
const topFeatures = window.LifeOSAnalytics.getTopFeatures(5);
console.log("Top Features:", topFeatures);

// Obter taxa de conclusão de uma tarefa específica
const taskRates = window.LifeOSAnalytics.getTaskCompletionRates();
console.log("Taxa de conclusão de 'Aprender TypeScript':", taskRates['Aprender TypeScript'].rate);
```

É importante notar que o `AnalyticsEngine` opera sobre dados armazenados localmente (no `localStorage` para fins de demonstração e desenvolvimento). Em um ambiente de produção, esses dados seriam persistidos em um backend de analytics para processamento e armazenamento escalável.
