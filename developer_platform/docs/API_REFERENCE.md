# LifeOS API Reference v2.0.0
**EXECUTION-009 | Developer Platform**

A API do LifeOS é organizada em torno de REST. Ela aceita requisições JSON codificadas, retorna respostas JSON codificadas e utiliza códigos de resposta HTTP padrão.

## Base URL
- **Produção:** `https://api.lifeos.app/api/v2`
- **Sandbox:** `https://sandbox.api.lifeos.app/api/v2`

## Autenticação

A API utiliza tokens Bearer para autenticação.

```http
Authorization: Bearer lk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

## Formato de Resposta Padrão

Todas as respostas da API v2 seguem um envelope padrão:

```json
{
  "data": {},
  "meta": {
    "total": 1,
    "cursor": null,
    "has_more": false
  },
  "_meta": {
    "request_id": "req_abc123",
    "processing_time_ms": 42.0,
    "api_version": "v2",
    "timestamp": "2026-07-10T12:00:00Z"
  }
}
```

## Tratamento de Erros

Em caso de erro, a API retorna um objeto `error` em vez de `data`:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Maximum 300 requests per 60 seconds.",
    "request_id": "req_abc123",
    "timestamp": "2026-07-10T12:00:00Z",
    "docs": "https://developers.lifeos.app/rate-limits"
  }
}
```

## Rate Limiting

Os limites de taxa são baseados no seu plano e são informados via cabeçalhos HTTP:

- `X-RateLimit-Limit`: O número máximo de requisições permitidas no período atual.
- `X-RateLimit-Remaining`: O número de requisições restantes no período atual.
- `X-RateLimit-Reset`: O timestamp UNIX em que o limite será redefinido.
- `Retry-After`: (Apenas em 429) Segundos a aguardar antes de tentar novamente.

## Endpoints Principais

### Memory
- `GET /memory` - Lista memórias (suporta `?limit=20&type=work&cursor=...`)
- `POST /memory` - Cria uma memória
- `GET /memory/{id}` - Obtém detalhes de uma memória
- `DELETE /memory/{id}` - Remove uma memória

### Timeline
- `GET /timeline` - Lista eventos da linha do tempo
- `POST /timeline/events` - Adiciona um novo evento

### Insights
- `GET /insights` - Lista insights gerados pela IA
- `GET /insights/summary` - Retorna um resumo executivo do estado atual

### Decisions
- `GET /decisions` - Lista decisões registradas
- `POST /decisions/{id}/analyze` - Solicita análise de IA para uma decisão específica

### Webhooks
- `GET /webhooks` - Lista webhooks registrados
- `POST /webhooks` - Registra um novo webhook
- `DELETE /webhooks/{id}` - Remove um webhook
- `POST /webhooks/{id}/test` - Dispara um evento de teste

### Sandbox
- `POST /developer/sandbox/reset` - Limpa todos os dados do sandbox
- `POST /developer/sandbox/seed` - Preenche o sandbox com dados de exemplo
