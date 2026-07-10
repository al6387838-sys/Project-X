# LifeOS Python SDK v2.0.0
**EXECUTION-009 | Developer Platform**

O SDK oficial do LifeOS fornece acesso programático completo aos motores de inteligência, memórias e decisões do LifeOS. Ele foi projetado para ser "type-safe", fácil de usar e sem necessidade de configuração complexa.

## Instalação

```bash
pip install lifeos-sdk
```

## Inicialização

O SDK suporta autenticação via API Key (para scripts e integrações backend) e OAuth 2.0 Bearer Token (para aplicações que atuam em nome do usuário).

```python
from lifeos_sdk import LifeOSClient

# Usando API Key (Recomendado para integrações backend)
client = LifeOSClient(api_key="lk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")

# Usando OAuth Token (Recomendado para apps de terceiros)
client = LifeOSClient(oauth_token="lk_token_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
```

## Tratamento de Erros

O SDK inclui exceções personalizadas para lidar com erros da API de forma estruturada.

```python
from lifeos_sdk import LifeOSClient
from lifeos_sdk.exceptions import RateLimitError, AuthenticationError, APIError

client = LifeOSClient(api_key="lk_live_...")

try:
    memories = client.memory.list()
except RateLimitError as e:
    print(f"Rate limit excedido. Tente novamente em {e.retry_after} segundos.")
except AuthenticationError:
    print("Chave de API inválida ou revogada.")
except APIError as e:
    print(f"Erro interno da API: {e.message} (Request ID: {e.request_id})")
```

## Recursos Disponíveis

### 1. Memory (`client.memory`)
Gerencia o armazenamento de longo e curto prazo do usuário.

```python
# Listar memórias (com paginação via cursor)
response = client.memory.list(limit=10, type="work")
for memory in response["data"]:
    print(memory["content"])

# Criar nova memória
new_memory = client.memory.create(
    content="Reunião com a equipe de produto sobre o Q3",
    type="work",
    tags=["meeting", "product"]
)

# Obter memória específica
memory = client.memory.get("mem_01abc")

# Deletar memória
client.memory.delete("mem_01abc")
```

### 2. Timeline (`client.timeline`)
Acessa o histórico cronológico de eventos significativos.

```python
# Listar eventos
events = client.timeline.list(from_date="2026-01-01")

# Adicionar evento
client.timeline.add_event(
    title="Lançamento do Developer Portal",
    date="2026-07-10",
    category="milestone"
)
```

### 3. Insights (`client.insights`)
Recupera padrões, riscos e oportunidades detectados pela IA do LifeOS.

```python
# Listar insights
insights = client.insights.list()

# Obter resumo geral
summary = client.insights.summary()
print(f"Score: {summary['data']['score']}")
```

### 4. Decisions (`client.decisions`)
Acessa o histórico de decisões e permite solicitar análises.

```python
# Listar decisões
decisions = client.decisions.list(status="approved")

# Solicitar análise de IA para uma decisão
analysis = client.decisions.analyze("dec_01abc")
```

### 5. Webhooks (`client.webhooks`)
Gerencia inscrições em eventos em tempo real.

```python
# Registrar webhook
webhook = client.webhooks.create(
    url="https://myapp.com/webhooks/lifeos",
    events=["memory.created", "insight.generated"],
    description="Integração principal"
)
print(f"Secret para validação: {webhook['data']['secret']}")

# Testar webhook
client.webhooks.test(webhook["data"]["webhook_id"])
```

### 6. Sandbox (`client.developer`)
Gerencia o ambiente isolado de testes.

```python
# Inicializar cliente de sandbox
sandbox_client = LifeOSClient(api_key="lk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")

# Popular com dados de exemplo
sandbox_client.developer.sandbox_seed()

# Resetar ambiente
sandbox_client.developer.sandbox_reset()
```
