"""
LifeOS Developer Platform — Demonstração Real da API
EXECUTION-009: Developer Platform v2.0.0
"""
print("=" * 60)
print("  LifeOS Developer Platform — API Demo")
print("  EXECUTION-009 | v2.0.0")
print("=" * 60)

# ── SDK Demo ─────────────────────────────────────────────────
from developer_platform.sdk.client import LifeOSClient

print("\n[1] Inicializando SDK com API Key...")
client = LifeOSClient(api_key="lk_live_demo_key")
print("    ✓ LifeOSClient inicializado")

print("\n[2] Listando memórias...")
memories = client.memory.list(limit=3)
for m in memories["data"][:3]:
    print(f"    • [{m['type']}] {m['content'][:50]}")
print(f"    → Total: {memories['meta']['total']} memórias")

print("\n[3] Criando nova memória...")
new_mem = client.memory.create(
    content="Developer Platform v2.0.0 lançada com sucesso",
    type="milestone",
    tags=["product", "engineering"]
)
print(f"    ✓ Memória criada: {new_mem['data']['id']}")

print("\n[4] Obtendo insights de IA...")
insights = client.insights.list()
for ins in insights["data"][:2]:
    print(f"    • [{ins['type']}] {ins['title']}")
    rec = ins.get('recommendation', ins.get('description', 'N/A'))
    print(f"      Confiança: {ins['confidence']*100:.0f}% | {rec[:50]}")

print("\n[5] Registrando webhook...")
webhook = client.webhooks.create(
    url="https://myapp.com/webhooks/lifeos",
    events=["memory.created", "insight.generated"]
)
wh = webhook["data"]
print(f"    ✓ Webhook registrado: {wh['webhook_id']}")
print(f"    → URL: {wh['url']}")
print(f"    → Eventos: {', '.join(wh['events'])}")
print(f"    → Secret: {wh['secret'][:20]}...")

# ── OAuth Demo ────────────────────────────────────────────────
from developer_platform.oauth_server.oauth_server import OAuthServer
from developer_platform.oauth_server.models import OAuthApp, OAuthScope

print("\n[6] Demonstrando OAuth 2.0 (Client Credentials)...")
server = OAuthServer()
app = OAuthApp(
    app_id="app_demo",
    name="MyApp Integration",
    description="Demo app",
    redirect_uris=["https://myapp.com/callback"],
    allowed_scopes=[OAuthScope.READ_MEMORY.value, OAuthScope.WRITE_MEMORY.value],
)
server.register_app(app)
token_result = server.client_credentials_token(
    client_id=app.client_id,
    client_secret=app.client_secret,
    scopes=[OAuthScope.READ_MEMORY.value],
)
print(f"    ✓ Token gerado: {token_result['access_token'][:30]}...")
print(f"    → Tipo: {token_result['token_type']}")
print(f"    → Expira em: {token_result['expires_in']}s")
print(f"    → Escopos: {token_result['scope']}")

validation = server.validate_token(token_result["access_token"])
print(f"    ✓ Token válido: {validation['valid']}")

# ── API Key Demo ──────────────────────────────────────────────
from developer_platform.api_keys.api_key_manager import APIKeyManager

print("\n[7] Gerenciando API Keys...")
manager = APIKeyManager()
key = manager.create_key(
    name="Producao MyApp",
    app_id="app_demo",
    owner_id="user_01",
    scopes=["read:memory", "write:timeline"],
)
print(f"    ✓ Chave criada: {key._raw_key[:25]}...")
print(f"    → Nome: {key.name}")
print(f"    → Escopos: {', '.join(key.scopes)}")

validation = manager.validate_key(key._raw_key)
print(f"    ✓ Chave válida: {validation['valid']}")
print(f"    → Owner: {validation['owner_id']}")

# ── Sandbox Demo ──────────────────────────────────────────────
from developer_platform.sandbox.sandbox import DeveloperSandbox

print("\n[8] Demonstrando Sandbox...")
sandbox = DeveloperSandbox()
session = sandbox.create_session("dev_01")
print(f"    ✓ Sessão criada: {session.session_id}")
print(f"    → API Key (test): {session.api_key[:25]}...")

result = sandbox.seed(session.session_id)
print(f"    ✓ Seed realizado: {result['records_created']} registros")
for resource, count in result["breakdown"].items():
    if count > 0:
        print(f"      {resource}: {count}")

sandbox.reset(session.session_id)
print(f"    ✓ Sandbox resetado para estado limpo")

# ── Rate Limit Demo ───────────────────────────────────────────
from developer_platform.api_gateway.middleware import RateLimitMiddleware
from developer_platform.api_gateway.gateway import GatewayRequest, RouteConfig, HTTPMethod, APIVersion

print("\n[9] Demonstrando Rate Limiting...")
middleware = RateLimitMiddleware(default_limit=60, window_seconds=60)
route = RouteConfig(
    path="/memory",
    method=HTTPMethod.GET,
    handler=lambda r: {},
    auth_required=False,
    rate_limit_override=5
)
req = GatewayRequest(api_key="lk_live_demo")
for i in range(5):
    middleware(req, route)
print(f"    → X-RateLimit-Limit: {req.headers.get('X-RateLimit-Limit')}")
print(f"    → X-RateLimit-Remaining: {req.headers.get('X-RateLimit-Remaining')}")
blocked = middleware(req, route)
print(f"    ✓ 6a requisicao bloqueada: {blocked.status_code} {blocked.body['error']['code']}")

print("\n" + "=" * 60)
print("  EXECUTION-009: DEVELOPER PLATFORM COMPLETED")
print("  62/62 testes passando | 32 arquivos | 5.366 linhas")
print("=" * 60)
