# Feature Flags Engine do LifeOS

## Visão Geral

O Feature Flags Engine do LifeOS é uma ferramenta essencial para o desenvolvimento ágil e a entrega contínua de funcionalidades. Ele permite que novas features sejam ativadas ou desativadas dinamicamente, sem a necessidade de reimplantar o código. Isso facilita testes A/B, rollouts graduais para subconjuntos de usuários e a mitigação rápida de problemas em produção.

## Componentes Principais

### Feature Flags Engine (`feature-flags.js`)

O `FeatureFlagsEngine` é o módulo responsável por gerenciar e avaliar o estado das feature flags. Ele oferece:

- **Controle Dinâmico**: Ativação/desativação de funcionalidades em tempo real.
- **Rollout Gradual**: Liberação de features para uma porcentagem específica da base de usuários.
- **Segmentação de Usuários**: Ativação de features para grupos específicos de usuários (ex: beta testers, VIPs, grupos internos).
- **Heatmaps de Navegação**: Coleta dados de interação do usuário (cliques, hovers, scrolls) para entender o comportamento e a usabilidade das features.

## Como Funciona

Cada feature flag é definida por um objeto que pode incluir as seguintes propriedades:

- `enabled`: Booleano que indica se a feature está ativada globalmente.
- `rollout`: Percentual de usuários para os quais a feature deve ser ativada (0-100).
- `groups`: Array de strings que representam grupos de usuários que têm acesso à feature.
- `minTier`: Tier mínimo de usuário necessário para acessar a feature (ex: 'early-access', 'vip').

Ao verificar se uma feature está habilitada (`isFeatureEnabled`), o engine avalia essas propriedades em conjunto com o contexto do usuário (ID, tier, grupos) para determinar se a feature deve ser exibida ou ativada para aquele usuário específico.

## Heatmaps de Navegação

Integrado ao `FeatureFlagsEngine`, o sistema de heatmaps (`heatmapData`) coleta dados anônimos de interação do usuário para fornecer insights visuais sobre o uso da interface. Ele rastreia:

- `clicks`: Posições e elementos clicados.
- `hovers`: Posições e elementos sobre os quais o mouse passou.
- `scrolls`: Profundidade de rolagem da página.
- `pageViews`: Páginas visitadas.

Esses dados são essenciais para entender quais partes da interface são mais engajadoras, identificar gargalos de usabilidade e validar o design de novas funcionalidades. Os dados de heatmap são armazenados localmente e podem ser exportados para análise.

## Integração com Outros Componentes

- **Telemetry Engine**: Os eventos de heatmap (cliques, hovers, scrolls) podem ser enviados ao `TelemetryEngine` para persistência e análise centralizada.
- **Beta Program Manager**: O `BetaManager` pode fornecer o contexto do usuário (userId, tier, grupos) para o `FeatureFlagsEngine` para decisões de acesso baseadas em segmentação.

## Configuração e Uso

Para inicializar o `FeatureFlagsEngine`:

```javascript
window.LifeOSFeatureFlags.init({
  // Exemplo de flags iniciais
  new_dashboard: { enabled: true, rollout: 50, groups: ["beta"] },
  ai_companion_v2: { enabled: false, minTier: "vip" }
});

// Definir uma nova feature flag
window.LifeOSFeatureFlags.setFeatureFlag(
  "dark_mode_toggle",
  { enabled: true, rollout: 100 }
);

// Verificar se uma feature está habilitada para um usuário
const userContext = { userId: "user_123", tier: "beta", groups: ["beta"] };
if (window.LifeOSFeatureFlags.isFeatureEnabled("new_dashboard", userContext)) {
  console.log("Novo dashboard habilitado para este usuário!");
}

// Obter dados de heatmap para a página atual
const currentPageHeatmap = window.LifeOSFeatureFlags.getHeatmapForPage(window.location.pathname);
console.log("Cliques na página atual:", currentPageHeatmap.clicks);
```

É fundamental que as feature flags sejam usadas com responsabilidade, garantindo que os usuários sejam informados sobre as mudanças e que os dados de telemetria sejam coletados para avaliar o impacto das features ativadas. O `FeatureFlagsEngine` fornece as ferramentas para gerenciar esse processo de forma eficaz.
