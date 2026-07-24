#!/usr/bin/env python3
"""
LifeOS Enterprise — Teste completo de APIs em produção local
Executa: GET, POST, PUT, PATCH, DELETE em todas as rotas
"""
import subprocess
import json
import hmac
import hashlib
import base64
import time
import sys

BASE = "http://localhost:8788"
PASS = 0
FAIL = 0
RESULTS = []

def base64url_encode(data):
    if isinstance(data, str):
        data = data.encode()
    return base64.urlsafe_b64encode(data).decode().rstrip('=')

def make_token(secret="qa-test-secret-2026"):
    payload_obj = {
        "sub": "test-user-001",
        "role": "user",
        "jti": f"qa-test-{int(time.time())}",
        "iat": int(time.time() * 1000),
        "exp": int((time.time() + 3600) * 1000)
    }
    payload = base64url_encode(json.dumps(payload_obj))
    sig = base64url_encode(hmac.new(secret.encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"

def api(method, path, data=None, headers=None, full=False):
    cmd = ["curl", "-s", "-X", method]
    if not full:
        cmd += ["-o", "/dev/null", "-w", "%{http_code}"]
    if headers:
        for k, v in headers.items():
            cmd += ["-H", f"{k}: {v}"]
    if data:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(data)]
    cmd.append(f"{BASE}{path}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    return result.stdout.strip()

def check(name, method, path, data=None, headers=None, expected=(200, 201)):
    global PASS, FAIL
    code = api(method, path, data=data, headers=headers)
    ok = int(code) in expected
    status = "PASS" if ok else f"FAIL({code})"
    RESULTS.append((name, status))
    if ok:
        PASS += 1
    else:
        FAIL += 1
    print(f"  {'✓' if ok else '✗'} {name}: {method} {path} → {code}")
    return code

token = make_token()
cookie = f"lifeos_session={token}"
auth = {"Cookie": cookie}

print("=" * 60)
print("LifeOS Enterprise — Teste Completo de APIs")
print("=" * 60)

print("\n[1] Autenticação — sem sessão deve retornar 401")
for path in ["/api/folders", "/api/documents", "/api/photos", "/api/agenda", "/api/kanban"]:
    check(f"Anônimo bloqueado {path}", "GET", path, expected=(401,))

print("\n[2] GET em todas as APIs autenticadas")
for path in ["/api/folders", "/api/documents", "/api/photos", "/api/agenda", "/api/kanban",
             "/api/crm", "/api/messages", "/api/events", "/api/integrations",
             "/api/ai-insights", "/api/briefing", "/api/dashboard",
             "/api/habits", "/api/goals", "/api/tasks"]:
    check(f"GET {path}", "GET", path, headers=auth)

print("\n[3] Teste de Pastas (CRUD completo)")
code = api("POST", "/api/folders", data={"action": "create", "name": "Pasta Teste QA"}, headers=auth, full=True)
data_resp = json.loads(code)
folder_id = data_resp.get('folder', {}).get('id')
ok = data_resp.get('ok')
print(f"  {'✓' if ok else '✗'} Criar pasta: ok={ok}, id={folder_id}")
if ok: PASS += 1
else: FAIL += 1

if folder_id:
    check("Renomear pasta (PUT)", "PUT", "/api/folders",
          data={"action": "rename", "id": folder_id, "name": "Pasta Renomeada QA"}, headers=auth)
    check("Listar pastas (GET)", "GET", "/api/folders", headers=auth)
    check("Excluir pasta (DELETE)", "DELETE", f"/api/folders?id={folder_id}", headers=auth)

print("\n[4] Teste de Agenda (CRUD completo)")
code = api("POST", "/api/agenda", data={"action": "create", "title": "Reunião QA", "date": "2026-07-25", "time": "10:00"}, headers=auth, full=True)
data_resp = json.loads(code)
event_id = data_resp.get('event', {}).get('id')
ok = data_resp.get('ok')
print(f"  {'✓' if ok else '✗'} Criar evento: ok={ok}, id={event_id}")
if ok: PASS += 1
else: FAIL += 1

if event_id:
    check("Atualizar evento (PATCH)", "PATCH", "/api/agenda",
          data={"action": "update", "id": event_id, "title": "Reunião Atualizada QA"}, headers=auth)
    check("Excluir evento (DELETE)", "DELETE", f"/api/agenda?id={event_id}", headers=auth)

print("\n[5] Teste de Kanban (CRUD completo)")
code = api("POST", "/api/kanban", data={"action": "add-card", "columnId": "todo", "title": "Card Teste QA"}, headers=auth, full=True)
data_resp = json.loads(code)
card_id = data_resp.get('card', {}).get('id')
ok = data_resp.get('ok')
print(f"  {'✓' if ok else '✗'} Criar card: ok={ok}, id={card_id}")
if ok: PASS += 1
else: FAIL += 1

if card_id:
    check("Mover card (PATCH)", "PATCH", "/api/kanban",
          data={"action": "move-card", "cardId": card_id, "columnId": "in-progress"}, headers=auth)
    check("Excluir card (DELETE)", "DELETE", f"/api/kanban?cardId={card_id}", headers=auth)

print("\n[6] Teste de CRM (CRUD completo)")
code = api("POST", "/api/crm", data={"action": "organization.create", "name": "Empresa Teste QA 2026"}, headers=auth, full=True)
data_resp = json.loads(code)
org_ok = data_resp.get('ok')
org_id = data_resp.get('data', {}).get('organization', {}).get('id') if org_ok else None
ws_id = data_resp.get('data', {}).get('workspace', {}).get('id') if org_ok else None
print(f"  {'✓' if org_ok else '✗'} Criar organização: ok={org_ok}, id={org_id}")
if org_ok: PASS += 1
else: FAIL += 1; print(f"    Erro: {data_resp.get('error')}")

if org_id and ws_id:
    code = api("POST", "/api/crm", data={
        "action": "contact.create",
        "orgId": org_id,
        "workspaceId": ws_id,
        "name": "João Silva QA",
        "email": "joao@qa.com"
    }, headers=auth, full=True)
    data_resp = json.loads(code)
    contact_ok = data_resp.get('ok')
    contact_count = len(data_resp.get('data', {}).get('contacts', []))
    print(f"  {'✓' if contact_ok else '✗'} Criar contato: ok={contact_ok}, total={contact_count}")
    if contact_ok: PASS += 1
    else: FAIL += 1; print(f"    Erro: {data_resp.get('error')}")

print("\n[7] Teste de Messages")
# Criar conversa primeiro, depois enviar mensagem
code = api("POST", "/api/messages", data={"action": "create", "title": "Conversa QA", "participant": "user2"}, headers=auth, full=True)
data_resp = json.loads(code)
conv_ok = data_resp.get('ok')
conv_id = data_resp.get('conversation', {}).get('id')
print(f"  {'✓' if conv_ok else '✗'} Criar conversa: ok={conv_ok}")
if conv_ok: PASS += 1
else: FAIL += 1; print(f"    Erro: {data_resp.get('error')}")
if conv_id:
    code = api("POST", "/api/messages", data={"action": "send", "convId": conv_id, "text": "Olá QA! Teste."}, headers=auth, full=True)
    data_resp = json.loads(code)
    msg_ok = data_resp.get('ok')
    print(f"  {'✓' if msg_ok else '✗'} Enviar mensagem: ok={msg_ok}")
    if msg_ok: PASS += 1
    else: FAIL += 1; print(f"    Erro: {data_resp.get('error')}")

print("\n[8] Teste de Integrations")
check("Listar integrações (GET)", "GET", "/api/integrations", headers=auth)
check("Conectar integração (POST)", "POST", "/api/integrations/connect",
      data={"provider": "google", "token": "test-token"}, headers=auth)

print("\n[9] Teste de AI Insights")
check("AI Insights GET", "GET", "/api/ai-insights", headers=auth)
check("AI Insights POST", "POST", "/api/ai-insights",
      data={"action": "generate", "context": "produtividade"}, headers=auth)

print("\n[10] Teste de Health e Version")
check("Health check", "GET", "/api/health", headers=auth, expected=(200,))
check("Version check", "GET", "/api/version", headers=auth, expected=(200,))

print("\n" + "=" * 60)
print(f"RESULTADO FINAL: {PASS} PASS | {FAIL} FAIL")
print("=" * 60)

if FAIL > 0:
    print("\nFalhas:")
    for name, status in RESULTS:
        if "FAIL" in status:
            print(f"  ✗ {name}: {status}")

sys.exit(0 if FAIL == 0 else 1)
