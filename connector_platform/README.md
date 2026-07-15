# LifeOS Integration Framework

> **Contrato arquitetural da Phase 061:** toda integração nova deve ser registrada e operada por meio de `IntegrationSDK`. Acesso direto aos managers internos por módulos de produto não é permitido.

## Superfície canônica

| Componente | Responsabilidade |
|---|---|
| `IntegrationSDK` | Fachada pública única para registro, autenticação, conexão, execução, webhooks e sincronização. |
| `OAuthManager` | Autorização OAuth 2.0 com PKCE, validação de estado, refresh e revogação. |
| `SecretsManager` | Segredos isolados por tenant, usuário e conector, com envelope autenticado, versões, rotação, expiração e auditoria. |
| `ConnectionManager` | Orquestra o ciclo de vida completo de cada conexão e sua limpeza segura. |
| `WebhookManager` | Registro, validação HMAC, roteamento, entrega, retry e replay de eventos. |
| `SyncManager` | Sincronização idempotente, incremental, agendada e com resolução de conflitos. |

## Regra de implementação

Um conector deve estender `BaseConnector`, declarar seu `ConnectorManifest` e implementar autenticação, renovação, revogação, teste de conexão e sincronização. O conector é então registrado exclusivamente na instância compartilhada de `IntegrationSDK`.

```python
from connector_platform import IntegrationSDK
from connector_platform.connectors.google.google_connectors import GoogleCalendarConnector

sdk = IntegrationSDK(tenant_id="enterprise")
sdk.register_connector(GoogleCalendarConnector)
```

Credenciais, tokens e segredos de webhook não devem ser armazenados diretamente por conectores ou módulos de domínio. O `SecretsManager` é a fonte canônica, e as APIs públicas do SDK devem ser usadas para leitura, rotação e exclusão.

## Garantias operacionais

O framework preserva **Zero Trust**, consentimento explícito por escopo, rate limiting, circuit breaker, auditoria, isolamento multi-tenant, refresh OAuth centralizado, limpeza transacional na desconexão, webhooks assinados e sincronização idempotente.

As extensões de negócio devem ser registradas com `register_extension`; elas não podem contornar o lifecycle de conexões, o gerenciamento de segredos ou as verificações de consentimento.

## Validação

Os contratos legados permanecem cobertos por `connector_platform/tests/test_connector_platform.py`. Os contratos definitivos da Phase 061 estão em `connector_platform/tests/test_integration_framework_phase061.py` e cobrem a superfície pública, segredos, OAuth, lifecycle E2E, webhooks e sincronização.
