// LifeOS Enterprise — Suíte de Homologação Local de Autenticação
// FASE HOMOLOGAÇÃO — Ambiente 100% isolado (MemoryKV, sem produção)
// Cobre: login, logout, refresh/renovação, sessão, expiração, RBAC,
//        permissões, middleware, proteção de rotas
//
// IMPORTANTE: Nenhum dado de produção é utilizado.
// Todas as credenciais são temporárias e geradas em memória.

import { createSession, verifySession, hasPermission, getCookie, sessionCookie, expiredSessionCookie, passwordDigest, safeEqual } from '../functions/_auth.js';
import { recordSession, revokeSession, revokeAllSessions, isSessionRevoked } from '../functions/_account.js';
import { onRequestPost as loginPost, onRequest as loginRequest } from '../functions/api/login.js';
import { onRequestPost as adminLoginPost } from '../functions/api/admin-login.js';
import { onRequestPost as logoutPost } from '../functions/api/logout.js';
import { onRequestGet as sessionGet } from '../functions/api/session.js';
import { onRequestGet as adminSessionGet } from '../functions/api/admin-session.js';
import { onRequest as appMiddleware } from '../functions/app/_middleware.js';
import { onRequest as adminMiddleware } from '../functions/admin/_middleware.js';

// ─────────────────────────────────────────────────────────────────────────────
// AMBIENTE DE DESENVOLVIMENTO ISOLADO — MemoryKV (sem produção)
// ─────────────────────────────────────────────────────────────────────────────

class MemoryKV {
  constructor() { this.store = new Map(); this.ttls = new Map(); }
  async get(key) {
    if (this.ttls.has(key) && Date.now() > this.ttls.get(key)) {
      this.store.delete(key); this.ttls.delete(key); return null;
    }
    return this.store.has(key) ? this.store.get(key) : null;
  }
  async put(key, value, opts = {}) {
    this.store.set(key, String(value));
    if (opts.expirationTtl) this.ttls.set(key, Date.now() + opts.expirationTtl * 1000);
  }
  async delete(key) { this.store.delete(key); this.ttls.delete(key); }
  async list({ prefix = '' } = {}) {
    const keys = [...this.store.keys()].filter(k => k.startsWith(prefix)).map(k => ({ name: k }));
    return { keys, list_complete: true, cursor: '' };
  }
  size() { return this.store.size; }
  clear() { this.store.clear(); this.ttls.clear(); }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREDENCIAIS DE TESTE — 100% temporárias, apenas para homologação local
// ─────────────────────────────────────────────────────────────────────────────

const DEV_SECRET = 'homologacao-local-dev-secret-2026-lifeos-enterprise';
const DEV_ADMIN_USER = 'admin-dev@lifeos.test';
const DEV_ADMIN_PASS = 'DevAdmin@2026!Test';
const DEV_USER_EMAIL = 'user-dev@lifeos.test';
const DEV_USER_PASS = 'DevUser@2026!Test';
const DEV_MANAGER_EMAIL = 'manager-dev@lifeos.test';
const DEV_VIEWER_EMAIL = 'viewer-dev@lifeos.test';

// ─────────────────────────────────────────────────────────────────────────────
// INFRAESTRUTURA DE TESTE
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];
const startTime = Date.now();

function check(condition, message) {
  if (!condition) throw new Error(message);
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push({ status: 'PASS', name });
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    results.push({ status: 'FAIL', name, detail: err.message });
    console.log(`  ✗ ${name}`);
    console.log(`      → ${err.message}`);
  }
}

function section(title) {
  console.log('');
  console.log(`── ${title}`);
}

function makeRequest(path, opts = {}) {
  const url = `https://lifeos.dev.test${path}`;
  return new Request(url, opts);
}

function makeAuthRequest(path, token, opts = {}) {
  return makeRequest(path, {
    ...opts,
    headers: { cookie: `lifeos_session=${token}`, ...(opts.headers || {}) },
  });
}

async function makeEnv(kv, overrides = {}) {
  const adminHash = await passwordDigest(DEV_ADMIN_PASS);
  return {
    LIFEOS_SESSION_SECRET: DEV_SECRET,
    LIFEOS_KV: kv,
    LIFEOS_ADMIN_USER: DEV_ADMIN_USER,
    LIFEOS_ADMIN_PASSWORD_HASH: adminHash,
    LIFEOS_ENV: 'development',
    ...overrides,
  };
}

async function seedUser(kv, email, password, role = 'user', extra = {}) {
  const hash = await passwordDigest(password);
  const user = {
    email,
    passwordHash: hash,
    role,
    name: `Dev ${role.charAt(0).toUpperCase() + role.slice(1)}`,
    emailVerified: true,
    status: 'active',
    onboarded: true,
    createdAt: new Date().toISOString(),
    ...extra,
  };
  await kv.put(`user:${email}`, JSON.stringify(user));
  return user;
}

async function postJson(handler, path, body, env, cookieToken = null) {
  const headers = { 'content-type': 'application/json' };
  if (cookieToken) headers.cookie = `lifeos_session=${cookieToken}`;
  const request = makeRequest(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const response = await handler({ request, env });
  let json = {};
  try { json = await response.json(); } catch { json = {}; }
  return { status: response.status, body: json, headers: response.headers };
}

async function getJson(handler, path, env, cookieToken = null) {
  const headers = {};
  if (cookieToken) headers.cookie = `lifeos_session=${cookieToken}`;
  const request = makeRequest(path, { method: 'GET', headers });
  const response = await handler({ request, env });
  let json = {};
  try { json = await response.json(); } catch { json = {}; }
  return { status: response.status, body: json, headers: response.headers };
}

async function middlewareRequest(handler, path, env, cookieToken = null) {
  const headers = {};
  if (cookieToken) headers.cookie = `lifeos_session=${cookieToken}`;
  const request = makeRequest(path, { method: 'GET', headers });
  let nextCalled = false;
  const next = async () => { nextCalled = true; return new Response('OK', { status: 200 }); };
  const response = await handler({ request, env, next });
  return { status: response.status, nextCalled, headers: response.headers };
}

// ─────────────────────────────────────────────────────────────────────────────
// INÍCIO DA SUÍTE
// ─────────────────────────────────────────────────────────────────────────────

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║   LifeOS Enterprise — Homologação Local de Autenticação         ║');
console.log('║   Ambiente: DESENVOLVIMENTO ISOLADO (MemoryKV)                  ║');
console.log('║   Produção: NÃO ACESSADA                                        ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');
console.log('');
console.log('  Credenciais: temporárias (apenas para este teste)');
console.log('  KV: MemoryKV em memória (sem Cloudflare)');
console.log('  R2: não utilizado nesta suíte');
console.log('  Banco: sem banco externo');
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 1 — MÓDULO CORE DE AUTENTICAÇÃO (_auth.js)
// ─────────────────────────────────────────────────────────────────────────────

section('1. Módulo Core de Autenticação (_auth.js)');

await test('createSession gera token válido para role=user', async () => {
  const token = await createSession('test@lifeos.test', 'user', DEV_SECRET);
  check(typeof token === 'string' && token.includes('.'), 'token deve ser string com ponto separador');
  check(token.length > 20, 'token deve ter comprimento adequado');
});

await test('createSession gera token válido para role=admin', async () => {
  const token = await createSession('admin@lifeos.test', 'admin', DEV_SECRET);
  check(typeof token === 'string' && token.includes('.'), 'token admin deve ser string com ponto');
});

await test('createSession gera token válido para role=manager', async () => {
  const token = await createSession('manager@lifeos.test', 'manager', DEV_SECRET);
  check(typeof token === 'string' && token.includes('.'), 'token manager deve ser string com ponto');
});

await test('createSession gera token válido para role=viewer', async () => {
  const token = await createSession('viewer@lifeos.test', 'viewer', DEV_SECRET);
  check(typeof token === 'string' && token.includes('.'), 'token viewer deve ser string com ponto');
});

await test('verifySession valida token legítimo e retorna payload correto', async () => {
  const token = await createSession('verify@lifeos.test', 'user', DEV_SECRET);
  const session = await verifySession(token, DEV_SECRET);
  check(session !== null, 'sessão deve ser retornada');
  check(session.sub === 'verify@lifeos.test', `sub deve ser 'verify@lifeos.test', recebeu '${session.sub}'`);
  check(session.role === 'user', `role deve ser 'user', recebeu '${session.role}'`);
  check(typeof session.jti === 'string' && session.jti.length > 0, 'jti deve estar presente');
  check(typeof session.iat === 'number', 'iat deve ser número');
  check(typeof session.exp === 'number', 'exp deve ser número');
  check(session.exp > session.iat, 'exp deve ser maior que iat');
});

await test('verifySession rejeita token com assinatura adulterada', async () => {
  const token = await createSession('tamper@lifeos.test', 'user', DEV_SECRET);
  const tampered = token.slice(0, -5) + 'XXXXX';
  const session = await verifySession(tampered, DEV_SECRET);
  check(session === null, 'sessão adulterada deve retornar null');
});

await test('verifySession rejeita token com secret errado', async () => {
  const token = await createSession('wrong@lifeos.test', 'user', DEV_SECRET);
  const session = await verifySession(token, 'wrong-secret-completely-different');
  check(session === null, 'token com secret errado deve retornar null');
});

await test('verifySession rejeita token nulo', async () => {
  const session = await verifySession(null, DEV_SECRET);
  check(session === null, 'token null deve retornar null');
});

await test('verifySession rejeita token vazio', async () => {
  const session = await verifySession('', DEV_SECRET);
  check(session === null, 'token vazio deve retornar null');
});

await test('verifySession rejeita token malformado (sem ponto)', async () => {
  const session = await verifySession('tokenSemPonto', DEV_SECRET);
  check(session === null, 'token sem ponto deve retornar null');
});

await test('verifySession rejeita token com caracteres inválidos', async () => {
  const session = await verifySession('abc<script>.def', DEV_SECRET);
  check(session === null, 'token com chars inválidos deve retornar null');
});

await test('verifySession detecta sessão expirada', async () => {
  // Criar token com expiração no passado via manipulação direta
  const kv = new MemoryKV();
  const token = await createSession('expired@lifeos.test', 'user', DEV_SECRET);
  const parts = token.split('.');
  // Decodificar payload, alterar exp para o passado
  const decoded = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
  decoded.exp = Date.now() - 1000; // 1 segundo no passado
  const newPayload = btoa(JSON.stringify(decoded)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  // Assinar com o secret correto para criar token expirado válido
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(DEV_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(newPayload));
  const b64sig = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const expiredToken = `${newPayload}.${b64sig}`;
  const session = await verifySession(expiredToken, DEV_SECRET, kv);
  check(session === null, 'token expirado deve retornar null');
});

await test('verifySession verifica revogação via KV', async () => {
  const kv = new MemoryKV();
  const token = await createSession('revoke-check@lifeos.test', 'user', DEV_SECRET);
  const session = await verifySession(token, DEV_SECRET, kv);
  check(session !== null, 'sessão deve ser válida antes da revogação');
  // Revogar o JTI
  await kv.put(`revoked-session:${session.jti}`, '1', { expirationTtl: 28800 });
  const afterRevoke = await verifySession(token, DEV_SECRET, kv);
  check(afterRevoke === null, 'sessão revogada deve retornar null');
});

await test('cada createSession gera JTI único', async () => {
  const t1 = await createSession('jti@lifeos.test', 'user', DEV_SECRET);
  const t2 = await createSession('jti@lifeos.test', 'user', DEV_SECRET);
  const s1 = await verifySession(t1, DEV_SECRET);
  const s2 = await verifySession(t2, DEV_SECRET);
  check(s1.jti !== s2.jti, 'JTIs devem ser únicos entre sessões');
});

await test('getCookie extrai token do header correto', () => {
  const header = 'other=abc; lifeos_session=TOKEN123; more=xyz';
  const token = getCookie(header);
  check(token === 'TOKEN123', `esperado 'TOKEN123', recebeu '${token}'`);
});

await test('getCookie retorna undefined sem cookie de sessão', () => {
  const token = getCookie('other=abc; another=xyz');
  check(token === undefined, 'deve retornar undefined quando cookie ausente');
});

await test('getCookie retorna undefined com header nulo', () => {
  const token = getCookie(null);
  check(token === undefined, 'deve retornar undefined com null');
});

await test('sessionCookie gera string com atributos de segurança', () => {
  const cookie = sessionCookie('TOKEN123');
  check(cookie.includes('lifeos_session=TOKEN123'), 'deve conter o token');
  check(cookie.includes('HttpOnly'), 'deve ter HttpOnly');
  check(cookie.includes('Secure'), 'deve ter Secure');
  check(cookie.includes('SameSite=Strict'), 'deve ter SameSite=Strict');
  check(cookie.includes('Path=/'), 'deve ter Path=/');
});

await test('expiredSessionCookie gera cookie com Max-Age=0', () => {
  const cookie = expiredSessionCookie();
  check(cookie.includes('Max-Age=0'), 'deve ter Max-Age=0');
  check(cookie.includes('lifeos_session='), 'deve conter o nome do cookie');
});

await test('passwordDigest gera hash SHA-256 consistente', async () => {
  const h1 = await passwordDigest('SenhaTest@123');
  const h2 = await passwordDigest('SenhaTest@123');
  check(h1 === h2, 'mesma senha deve gerar mesmo hash');
  check(h1.length === 64, `hash deve ter 64 chars, recebeu ${h1.length}`);
});

await test('passwordDigest gera hashes distintos para senhas diferentes', async () => {
  const h1 = await passwordDigest('SenhaA@123');
  const h2 = await passwordDigest('SenhaB@456');
  check(h1 !== h2, 'senhas diferentes devem gerar hashes diferentes');
});

await test('safeEqual compara strings de forma segura (timing-safe)', () => {
  check(safeEqual('abc', 'abc') === true, 'strings iguais devem retornar true');
  check(safeEqual('abc', 'xyz') === false, 'strings diferentes devem retornar false');
  check(safeEqual('abc', 'abcd') === false, 'comprimentos diferentes devem retornar false');
  check(safeEqual(null, 'abc') === false, 'null deve retornar false');
  check(safeEqual('abc', null) === false, 'null deve retornar false');
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 2 — RBAC E PERMISSÕES
// ─────────────────────────────────────────────────────────────────────────────

section('2. RBAC e Permissões (hasPermission)');

await test('admin tem permissão para todos os roles (hierarquia 4)', async () => {
  const token = await createSession('admin@lifeos.test', 'admin', DEV_SECRET);
  const session = await verifySession(token, DEV_SECRET);
  check(hasPermission(session, 'admin') === true, 'admin deve ter permissão admin');
  check(hasPermission(session, 'manager') === true, 'admin deve ter permissão manager');
  check(hasPermission(session, 'user') === true, 'admin deve ter permissão user');
  check(hasPermission(session, 'viewer') === true, 'admin deve ter permissão viewer');
});

await test('manager tem permissão para manager, user, viewer mas não admin', async () => {
  const token = await createSession('mgr@lifeos.test', 'manager', DEV_SECRET);
  const session = await verifySession(token, DEV_SECRET);
  check(hasPermission(session, 'admin') === false, 'manager NÃO deve ter permissão admin');
  check(hasPermission(session, 'manager') === true, 'manager deve ter permissão manager');
  check(hasPermission(session, 'user') === true, 'manager deve ter permissão user');
  check(hasPermission(session, 'viewer') === true, 'manager deve ter permissão viewer');
});

await test('user tem permissão para user e viewer mas não admin/manager', async () => {
  const token = await createSession('usr@lifeos.test', 'user', DEV_SECRET);
  const session = await verifySession(token, DEV_SECRET);
  check(hasPermission(session, 'admin') === false, 'user NÃO deve ter permissão admin');
  check(hasPermission(session, 'manager') === false, 'user NÃO deve ter permissão manager');
  check(hasPermission(session, 'user') === true, 'user deve ter permissão user');
  check(hasPermission(session, 'viewer') === true, 'user deve ter permissão viewer');
});

await test('viewer tem permissão apenas para viewer', async () => {
  const token = await createSession('view@lifeos.test', 'viewer', DEV_SECRET);
  const session = await verifySession(token, DEV_SECRET);
  check(hasPermission(session, 'admin') === false, 'viewer NÃO deve ter permissão admin');
  check(hasPermission(session, 'manager') === false, 'viewer NÃO deve ter permissão manager');
  check(hasPermission(session, 'user') === false, 'viewer NÃO deve ter permissão user');
  check(hasPermission(session, 'viewer') === true, 'viewer deve ter permissão viewer');
});

await test('sessão nula não tem nenhuma permissão', () => {
  check(hasPermission(null, 'viewer') === false, 'null não deve ter permissão viewer');
  check(hasPermission(null, 'user') === false, 'null não deve ter permissão user');
  check(hasPermission(undefined, 'admin') === false, 'undefined não deve ter permissão admin');
});

await test('role desconhecido não tem nenhuma permissão', async () => {
  const token = await createSession('unknown@lifeos.test', 'superuser', DEV_SECRET);
  const session = await verifySession(token, DEV_SECRET);
  check(hasPermission(session, 'viewer') === false, 'role desconhecido não deve ter permissão viewer');
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 3 — GESTÃO DE SESSÕES (_account.js)
// ─────────────────────────────────────────────────────────────────────────────

section('3. Gestão de Sessões (_account.js)');

await test('recordSession persiste sessão no KV', async () => {
  const kv = new MemoryKV();
  const token = await createSession('record@lifeos.test', 'user', DEV_SECRET);
  const session = await verifySession(token, DEV_SECRET);
  const request = makeRequest('/api/login', {
    method: 'POST',
    headers: { 'user-agent': 'Mozilla/5.0 (Test)', 'x-forwarded-for': '127.0.0.1' },
  });
  const record = await recordSession(kv, session, request);
  check(record !== null, 'record deve ser retornado');
  check(record.id === session.jti, 'record.id deve ser o JTI da sessão');
  const stored = await kv.get(`sessions:${session.sub}`);
  check(stored !== null, 'sessão deve estar no KV');
  const sessions = JSON.parse(stored);
  check(sessions.length === 1, 'deve haver 1 sessão armazenada');
  check(sessions[0].id === session.jti, 'ID da sessão armazenada deve corresponder ao JTI');
});

await test('recordSession armazena múltiplas sessões (até 10)', async () => {
  const kv = new MemoryKV();
  for (let i = 0; i < 3; i++) {
    const token = await createSession('multi@lifeos.test', 'user', DEV_SECRET);
    const session = await verifySession(token, DEV_SECRET);
    const request = makeRequest('/api/login', {
      headers: { 'user-agent': `Browser-${i}`, 'x-forwarded-for': '127.0.0.1' },
    });
    await recordSession(kv, session, request);
  }
  const stored = await kv.get('sessions:multi@lifeos.test');
  const sessions = JSON.parse(stored);
  check(sessions.length === 3, `deve haver 3 sessões, recebeu ${sessions.length}`);
});

await test('revokeSession remove sessão do KV e adiciona ao blocklist', async () => {
  const kv = new MemoryKV();
  const token = await createSession('revoke@lifeos.test', 'user', DEV_SECRET);
  const session = await verifySession(token, DEV_SECRET);
  const request = makeRequest('/api/login', { headers: { 'user-agent': 'Test', 'x-forwarded-for': '127.0.0.1' } });
  await recordSession(kv, session, request);
  await revokeSession(kv, session.sub, session.jti);
  const revoked = await kv.get(`revoked-session:${session.jti}`);
  check(revoked === '1', 'JTI deve estar no blocklist');
  const afterRevoke = await verifySession(token, DEV_SECRET, kv);
  check(afterRevoke === null, 'token revogado não deve ser válido');
});

await test('revokeAllSessions revoga todas as sessões do usuário', async () => {
  const kv = new MemoryKV();
  const tokens = [];
  for (let i = 0; i < 3; i++) {
    const token = await createSession('revokeall@lifeos.test', 'user', DEV_SECRET);
    const session = await verifySession(token, DEV_SECRET);
    const request = makeRequest('/api/login', { headers: { 'user-agent': `Browser-${i}`, 'x-forwarded-for': '127.0.0.1' } });
    await recordSession(kv, session, request);
    tokens.push(token);
  }
  await revokeAllSessions(kv, 'revokeall@lifeos.test');
  for (const token of tokens) {
    const session = await verifySession(token, DEV_SECRET, kv);
    check(session === null, 'todas as sessões devem ser revogadas');
  }
});

await test('revokeAllSessions preserva sessão corrente quando exceptId fornecido', async () => {
  const kv = new MemoryKV();
  const tokens = [];
  const sessions = [];
  for (let i = 0; i < 3; i++) {
    const token = await createSession('revokeexcept@lifeos.test', 'user', DEV_SECRET);
    const session = await verifySession(token, DEV_SECRET);
    const request = makeRequest('/api/login', { headers: { 'user-agent': `Browser-${i}`, 'x-forwarded-for': '127.0.0.1' } });
    await recordSession(kv, session, request);
    tokens.push(token);
    sessions.push(session);
  }
  // Preservar a última sessão
  const currentJti = sessions[2].jti;
  await revokeAllSessions(kv, 'revokeexcept@lifeos.test', currentJti);
  // As duas primeiras devem estar revogadas
  for (let i = 0; i < 2; i++) {
    const s = await verifySession(tokens[i], DEV_SECRET, kv);
    check(s === null, `sessão ${i} deve estar revogada`);
  }
  // A terceira deve permanecer válida
  const current = await verifySession(tokens[2], DEV_SECRET, kv);
  check(current !== null, 'sessão corrente deve permanecer válida');
});

await test('isSessionRevoked retorna true para JTI revogado', async () => {
  const kv = new MemoryKV();
  const token = await createSession('isrevoked@lifeos.test', 'user', DEV_SECRET);
  const session = await verifySession(token, DEV_SECRET);
  await kv.put(`revoked-session:${session.jti}`, '1', { expirationTtl: 28800 });
  const revoked = await isSessionRevoked(kv, session);
  check(revoked === true, 'isSessionRevoked deve retornar true');
});

await test('isSessionRevoked retorna false para JTI ativo', async () => {
  const kv = new MemoryKV();
  const token = await createSession('notrevoked@lifeos.test', 'user', DEV_SECRET);
  const session = await verifySession(token, DEV_SECRET);
  const revoked = await isSessionRevoked(kv, session);
  check(revoked === false, 'isSessionRevoked deve retornar false para sessão ativa');
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 4 — LOGIN (POST /api/login)
// ─────────────────────────────────────────────────────────────────────────────

section('4. Login (POST /api/login)');

await test('login de usuário regular com credenciais corretas retorna 200 + cookie', async () => {
  const kv = new MemoryKV();
  await seedUser(kv, DEV_USER_EMAIL, DEV_USER_PASS, 'user');
  const env = await makeEnv(kv);
  const result = await postJson(loginPost, '/api/login', { email: DEV_USER_EMAIL, password: DEV_USER_PASS }, env);
  check(result.status === 200, `esperado 200, recebeu ${result.status}`);
  check(result.body.ok === true, 'body.ok deve ser true');
  check(result.body.user?.username === DEV_USER_EMAIL, 'username deve corresponder');
  check(result.body.user?.role === 'user', 'role deve ser user');
  const setCookie = result.headers.get('set-cookie');
  check(setCookie !== null, 'set-cookie deve estar presente');
  check(setCookie.includes('lifeos_session='), 'set-cookie deve conter lifeos_session');
  check(setCookie.includes('HttpOnly'), 'cookie deve ter HttpOnly');
});

await test('login de admin via endpoint unificado retorna 200 + cookie admin', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await postJson(loginPost, '/api/login', { email: DEV_ADMIN_USER, password: DEV_ADMIN_PASS }, env);
  check(result.status === 200, `esperado 200, recebeu ${result.status}`);
  check(result.body.ok === true, 'body.ok deve ser true');
  check(result.body.user?.role === 'admin', 'role deve ser admin');
  check(result.body.redirect === '/admin', 'redirect deve ser /admin');
});

await test('login com senha incorreta retorna 401', async () => {
  const kv = new MemoryKV();
  await seedUser(kv, DEV_USER_EMAIL, DEV_USER_PASS, 'user');
  const env = await makeEnv(kv);
  const result = await postJson(loginPost, '/api/login', { email: DEV_USER_EMAIL, password: 'SenhaErrada@999' }, env);
  check(result.status === 401, `esperado 401, recebeu ${result.status}`);
  check(result.body.ok === false, 'body.ok deve ser false');
});

await test('login com usuário inexistente retorna 401', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await postJson(loginPost, '/api/login', { email: 'naoexiste@lifeos.test', password: 'qualquer' }, env);
  check(result.status === 401, `esperado 401, recebeu ${result.status}`);
  check(result.body.ok === false, 'body.ok deve ser false');
});

await test('login sem e-mail retorna 400', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await postJson(loginPost, '/api/login', { password: 'senha123' }, env);
  check(result.status === 400, `esperado 400, recebeu ${result.status}`);
});

await test('login sem senha retorna 400', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await postJson(loginPost, '/api/login', { email: DEV_USER_EMAIL }, env);
  check(result.status === 400, `esperado 400, recebeu ${result.status}`);
});

await test('login com e-mail não verificado retorna 403 com código EMAIL_CONFIRMATION_REQUIRED', async () => {
  const kv = new MemoryKV();
  await seedUser(kv, 'unverified@lifeos.test', DEV_USER_PASS, 'user', { emailVerified: false });
  const env = await makeEnv(kv);
  const result = await postJson(loginPost, '/api/login', { email: 'unverified@lifeos.test', password: DEV_USER_PASS }, env);
  check(result.status === 403, `esperado 403, recebeu ${result.status}`);
  check(result.body.code === 'EMAIL_CONFIRMATION_REQUIRED', `código esperado EMAIL_CONFIRMATION_REQUIRED, recebeu ${result.body.code}`);
});

await test('login com conta inativa retorna 403', async () => {
  const kv = new MemoryKV();
  await seedUser(kv, 'inactive@lifeos.test', DEV_USER_PASS, 'user', { status: 'suspended' });
  const env = await makeEnv(kv);
  const result = await postJson(loginPost, '/api/login', { email: 'inactive@lifeos.test', password: DEV_USER_PASS }, env);
  check(result.status === 403, `esperado 403, recebeu ${result.status}`);
});

await test('login sem LIFEOS_SESSION_SECRET retorna 503', async () => {
  const kv = new MemoryKV();
  const env = { LIFEOS_KV: kv };
  const result = await postJson(loginPost, '/api/login', { email: DEV_USER_EMAIL, password: DEV_USER_PASS }, env);
  check(result.status === 503, `esperado 503, recebeu ${result.status}`);
  check(result.body.code === 'SESSION_SECRET_MISSING', `código esperado SESSION_SECRET_MISSING, recebeu ${result.body.code}`);
});

await test('login sem LIFEOS_KV retorna 503', async () => {
  const env = { LIFEOS_SESSION_SECRET: DEV_SECRET };
  const result = await postJson(loginPost, '/api/login', { email: DEV_USER_EMAIL, password: DEV_USER_PASS }, env);
  check(result.status === 503, `esperado 503, recebeu ${result.status}`);
  check(result.body.code === 'KV_MISSING', `código esperado KV_MISSING, recebeu ${result.body.code}`);
});

await test('login com método GET retorna 405', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const request = makeRequest('/api/login', { method: 'GET' });
  const response = await loginRequest({ request, env });
  check(response.status === 405, `esperado 405, recebeu ${response.status}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 5 — ADMIN LOGIN (POST /api/admin-login)
// ─────────────────────────────────────────────────────────────────────────────

section('5. Admin Login (POST /api/admin-login)');

await test('admin login com credenciais corretas retorna 200 + cookie admin', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await postJson(adminLoginPost, '/api/admin-login', { username: DEV_ADMIN_USER, password: DEV_ADMIN_PASS }, env);
  check(result.status === 200, `esperado 200, recebeu ${result.status}`);
  check(result.body.ok === true, 'body.ok deve ser true');
  check(result.body.user?.role === 'admin', 'role deve ser admin');
  const setCookie = result.headers.get('set-cookie');
  check(setCookie !== null && setCookie.includes('lifeos_session='), 'set-cookie deve conter sessão');
});

await test('admin login com senha incorreta retorna 401', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await postJson(adminLoginPost, '/api/admin-login', { username: DEV_ADMIN_USER, password: 'SenhaErrada@999' }, env);
  check(result.status === 401, `esperado 401, recebeu ${result.status}`);
});

await test('admin login sem SESSION_SECRET retorna 503', async () => {
  const kv = new MemoryKV();
  const adminHash = await passwordDigest(DEV_ADMIN_PASS);
  const env = { LIFEOS_KV: kv, LIFEOS_ADMIN_USER: DEV_ADMIN_USER, LIFEOS_ADMIN_PASSWORD_HASH: adminHash };
  const result = await postJson(adminLoginPost, '/api/admin-login', { username: DEV_ADMIN_USER, password: DEV_ADMIN_PASS }, env);
  check(result.status === 503, `esperado 503, recebeu ${result.status}`);
});

await test('admin login sem credenciais configuradas retorna 503', async () => {
  const env = { LIFEOS_SESSION_SECRET: DEV_SECRET };
  const result = await postJson(adminLoginPost, '/api/admin-login', { username: DEV_ADMIN_USER, password: DEV_ADMIN_PASS }, env);
  check(result.status === 503, `esperado 503, recebeu ${result.status}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 6 — LOGOUT (POST /api/logout)
// ─────────────────────────────────────────────────────────────────────────────

section('6. Logout (POST /api/logout)');

await test('logout com sessão válida retorna 200 e cookie expirado', async () => {
  const kv = new MemoryKV();
  await seedUser(kv, DEV_USER_EMAIL, DEV_USER_PASS, 'user');
  const env = await makeEnv(kv);
  // Fazer login primeiro
  const loginResult = await postJson(loginPost, '/api/login', { email: DEV_USER_EMAIL, password: DEV_USER_PASS }, env);
  const setCookie = loginResult.headers.get('set-cookie');
  const tokenMatch = setCookie.match(/lifeos_session=([^;]+)/);
  check(tokenMatch !== null, 'deve extrair token do cookie de login');
  const token = tokenMatch[1];
  // Fazer logout
  const result = await postJson(logoutPost, '/api/logout', {}, env, token);
  check(result.status === 200, `esperado 200, recebeu ${result.status}`);
  check(result.body.ok === true, 'body.ok deve ser true');
  const logoutCookie = result.headers.get('set-cookie');
  check(logoutCookie !== null, 'set-cookie deve estar presente no logout');
  check(logoutCookie.includes('Max-Age=0'), 'cookie deve ter Max-Age=0 no logout');
  // Verificar que a sessão foi revogada
  const afterLogout = await verifySession(token, DEV_SECRET, kv);
  check(afterLogout === null, 'token deve ser inválido após logout');
});

await test('logout sem sessão retorna 200 (graceful)', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await postJson(logoutPost, '/api/logout', {}, env);
  check(result.status === 200, `esperado 200, recebeu ${result.status} (logout sem sessão deve ser graceful)`);
  check(result.body.ok === true, 'body.ok deve ser true mesmo sem sessão');
});

await test('logout com token inválido retorna 200 (graceful)', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await postJson(logoutPost, '/api/logout', {}, env, 'token-invalido-xyz');
  check(result.status === 200, `esperado 200, recebeu ${result.status}`);
});

await test('token não pode ser reutilizado após logout', async () => {
  const kv = new MemoryKV();
  await seedUser(kv, DEV_USER_EMAIL, DEV_USER_PASS, 'user');
  const env = await makeEnv(kv);
  const loginResult = await postJson(loginPost, '/api/login', { email: DEV_USER_EMAIL, password: DEV_USER_PASS }, env);
  const setCookie = loginResult.headers.get('set-cookie');
  const token = setCookie.match(/lifeos_session=([^;]+)/)[1];
  // Logout
  await postJson(logoutPost, '/api/logout', {}, env, token);
  // Tentar usar o token após logout
  const sessionResult = await getJson(sessionGet, '/api/session', env, token);
  check(sessionResult.status === 401, `token revogado deve retornar 401, recebeu ${sessionResult.status}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 7 — VERIFICAÇÃO DE SESSÃO (GET /api/session)
// ─────────────────────────────────────────────────────────────────────────────

section('7. Verificação de Sessão (GET /api/session)');

await test('GET /api/session com token válido retorna 200 com dados do usuário', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const token = await createSession(DEV_USER_EMAIL, 'user', DEV_SECRET);
  const result = await getJson(sessionGet, '/api/session', env, token);
  check(result.status === 200, `esperado 200, recebeu ${result.status}`);
  check(result.body.ok === true, 'body.ok deve ser true');
  check(result.body.user?.username === DEV_USER_EMAIL, 'username deve corresponder');
  check(result.body.user?.role === 'user', 'role deve ser user');
});

await test('GET /api/session sem cookie retorna 401', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await getJson(sessionGet, '/api/session', env);
  check(result.status === 401, `esperado 401, recebeu ${result.status}`);
  check(result.body.ok === false, 'body.ok deve ser false');
});

await test('GET /api/session com token inválido retorna 401', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await getJson(sessionGet, '/api/session', env, 'token-invalido');
  check(result.status === 401, `esperado 401, recebeu ${result.status}`);
});

await test('GET /api/session?optional=1 sem cookie retorna 200 com ok:false', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const request = makeRequest('/api/session?optional=1', { method: 'GET' });
  const response = await sessionGet({ request, env });
  const body = await response.json();
  check(response.status === 200, `esperado 200, recebeu ${response.status}`);
  check(body.ok === false, 'body.ok deve ser false para sessão opcional ausente');
});

await test('GET /api/session sem SESSION_SECRET retorna 503', async () => {
  const kv = new MemoryKV();
  const env = { LIFEOS_KV: kv };
  const result = await getJson(sessionGet, '/api/session', env);
  check(result.status === 503, `esperado 503, recebeu ${result.status}`);
});

await test('GET /api/session admin retorna redirect=/admin', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const token = await createSession(DEV_ADMIN_USER, 'admin', DEV_SECRET);
  const result = await getJson(sessionGet, '/api/session', env, token);
  check(result.status === 200, `esperado 200, recebeu ${result.status}`);
  check(result.body.redirect === '/admin', `redirect deve ser /admin, recebeu ${result.body.redirect}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 8 — RENOVAÇÃO DE SESSÃO (REFRESH TOKEN)
// ─────────────────────────────────────────────────────────────────────────────

section('8. Renovação de Sessão (Refresh / Re-autenticação)');

await test('sessão válida permanece ativa dentro do período de 8h', async () => {
  const token = await createSession('refresh@lifeos.test', 'user', DEV_SECRET);
  const session = await verifySession(token, DEV_SECRET);
  check(session !== null, 'sessão deve ser válida');
  const duration = session.exp - session.iat;
  const expectedMs = 8 * 60 * 60 * 1000;
  check(Math.abs(duration - expectedMs) < 5000, `duração deve ser ~8h, recebeu ${duration}ms`);
});

await test('re-autenticação gera nova sessão com novo JTI', async () => {
  const kv = new MemoryKV();
  await seedUser(kv, DEV_USER_EMAIL, DEV_USER_PASS, 'user');
  const env = await makeEnv(kv);
  const r1 = await postJson(loginPost, '/api/login', { email: DEV_USER_EMAIL, password: DEV_USER_PASS }, env);
  const t1 = r1.headers.get('set-cookie').match(/lifeos_session=([^;]+)/)[1];
  const s1 = await verifySession(t1, DEV_SECRET);
  const r2 = await postJson(loginPost, '/api/login', { email: DEV_USER_EMAIL, password: DEV_USER_PASS }, env);
  const t2 = r2.headers.get('set-cookie').match(/lifeos_session=([^;]+)/)[1];
  const s2 = await verifySession(t2, DEV_SECRET);
  check(s1.jti !== s2.jti, 'cada login deve gerar JTI único');
  check(t1 !== t2, 'cada login deve gerar token diferente');
});

await test('sessão antiga permanece válida após novo login (multi-sessão)', async () => {
  const kv = new MemoryKV();
  await seedUser(kv, DEV_USER_EMAIL, DEV_USER_PASS, 'user');
  const env = await makeEnv(kv);
  const r1 = await postJson(loginPost, '/api/login', { email: DEV_USER_EMAIL, password: DEV_USER_PASS }, env);
  const t1 = r1.headers.get('set-cookie').match(/lifeos_session=([^;]+)/)[1];
  await postJson(loginPost, '/api/login', { email: DEV_USER_EMAIL, password: DEV_USER_PASS }, env);
  // Sessão anterior deve ainda ser válida (multi-sessão permitida)
  const s1 = await verifySession(t1, DEV_SECRET, kv);
  check(s1 !== null, 'sessão anterior deve permanecer válida após novo login');
});

await test('revogação de sessão específica não afeta outras sessões', async () => {
  const kv = new MemoryKV();
  await seedUser(kv, DEV_USER_EMAIL, DEV_USER_PASS, 'user');
  const env = await makeEnv(kv);
  const r1 = await postJson(loginPost, '/api/login', { email: DEV_USER_EMAIL, password: DEV_USER_PASS }, env);
  const t1 = r1.headers.get('set-cookie').match(/lifeos_session=([^;]+)/)[1];
  const s1 = await verifySession(t1, DEV_SECRET);
  const r2 = await postJson(loginPost, '/api/login', { email: DEV_USER_EMAIL, password: DEV_USER_PASS }, env);
  const t2 = r2.headers.get('set-cookie').match(/lifeos_session=([^;]+)/)[1];
  // Revogar apenas a primeira sessão
  await revokeSession(kv, DEV_USER_EMAIL, s1.jti);
  const afterRevoke1 = await verifySession(t1, DEV_SECRET, kv);
  const afterRevoke2 = await verifySession(t2, DEV_SECRET, kv);
  check(afterRevoke1 === null, 'sessão 1 deve estar revogada');
  check(afterRevoke2 !== null, 'sessão 2 deve permanecer válida');
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 9 — MIDDLEWARE E PROTEÇÃO DE ROTAS
// ─────────────────────────────────────────────────────────────────────────────

section('9. Middleware e Proteção de Rotas');

await test('middleware /app permite acesso com sessão user válida', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const token = await createSession(DEV_USER_EMAIL, 'user', DEV_SECRET);
  const result = await middlewareRequest(appMiddleware, '/app/dashboard', env, token);
  check(result.nextCalled === true, 'next() deve ser chamado para usuário autenticado');
});

await test('middleware /app permite acesso com sessão admin válida', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const token = await createSession(DEV_ADMIN_USER, 'admin', DEV_SECRET);
  const result = await middlewareRequest(appMiddleware, '/app/dashboard', env, token);
  check(result.nextCalled === true, 'next() deve ser chamado para admin em /app');
});

await test('middleware /app redireciona para /login/ sem sessão', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await middlewareRequest(appMiddleware, '/app/dashboard', env);
  check(result.nextCalled === false, 'next() NÃO deve ser chamado sem sessão');
  check(result.status === 302, `esperado redirect 302, recebeu ${result.status}`);
  const location = result.headers.get('location');
  check(location !== null && location.includes('/login/'), `redirect deve ser para /login/, recebeu ${location}`);
});

await test('middleware /app redireciona para /login/ com token inválido', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await middlewareRequest(appMiddleware, '/app/dashboard', env, 'token-invalido');
  check(result.nextCalled === false, 'next() NÃO deve ser chamado com token inválido');
  check(result.status === 302, `esperado redirect 302, recebeu ${result.status}`);
});

await test('middleware /app redireciona para /login/ sem SESSION_SECRET', async () => {
  const kv = new MemoryKV();
  const env = { LIFEOS_KV: kv };
  const result = await middlewareRequest(appMiddleware, '/app/dashboard', env);
  check(result.status === 302, `esperado redirect 302, recebeu ${result.status}`);
});

await test('middleware /admin permite acesso com sessão admin válida', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const token = await createSession(DEV_ADMIN_USER, 'admin', DEV_SECRET);
  const result = await middlewareRequest(adminMiddleware, '/admin/dashboard', env, token);
  check(result.nextCalled === true, 'next() deve ser chamado para admin em /admin');
});

await test('middleware /admin redireciona usuário comum para /app', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const token = await createSession(DEV_USER_EMAIL, 'user', DEV_SECRET);
  const result = await middlewareRequest(adminMiddleware, '/admin/dashboard', env, token);
  check(result.nextCalled === false, 'next() NÃO deve ser chamado para user em /admin');
  check(result.status === 302, `esperado redirect 302, recebeu ${result.status}`);
  const location = result.headers.get('location');
  check(location !== null && location.includes('/app'), `redirect deve ser para /app, recebeu ${location}`);
});

await test('middleware /admin redireciona manager para /app (não é admin)', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const token = await createSession(DEV_MANAGER_EMAIL, 'manager', DEV_SECRET);
  const result = await middlewareRequest(adminMiddleware, '/admin/dashboard', env, token);
  check(result.nextCalled === false, 'next() NÃO deve ser chamado para manager em /admin');
  check(result.status === 302, `esperado redirect 302, recebeu ${result.status}`);
});

await test('middleware /admin redireciona viewer para /app (não é admin)', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const token = await createSession(DEV_VIEWER_EMAIL, 'viewer', DEV_SECRET);
  const result = await middlewareRequest(adminMiddleware, '/admin/dashboard', env, token);
  check(result.nextCalled === false, 'next() NÃO deve ser chamado para viewer em /admin');
  check(result.status === 302, `esperado redirect 302, recebeu ${result.status}`);
});

await test('middleware /admin redireciona para /login sem sessão', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await middlewareRequest(adminMiddleware, '/admin/dashboard', env);
  check(result.nextCalled === false, 'next() NÃO deve ser chamado sem sessão');
  check(result.status === 302, `esperado redirect 302, recebeu ${result.status}`);
  const location = result.headers.get('location');
  check(location !== null && location.includes('/login'), `redirect deve ser para /login, recebeu ${location}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 10 — EXPIRAÇÃO DE SESSÃO
// ─────────────────────────────────────────────────────────────────────────────

section('10. Expiração de Sessão');

await test('sessão tem expiração de 8 horas (28800 segundos)', async () => {
  const before = Date.now();
  const token = await createSession('expiry@lifeos.test', 'user', DEV_SECRET);
  const session = await verifySession(token, DEV_SECRET);
  const after = Date.now();
  const expectedExp = before + 8 * 60 * 60 * 1000;
  check(session.exp >= expectedExp - 1000, 'exp deve ser ~8h a partir de agora');
  check(session.exp <= after + 8 * 60 * 60 * 1000 + 1000, 'exp não deve ser maior que 8h + margem');
});

await test('token expirado é rejeitado pelo verifySession', async () => {
  // Criar token com exp no passado
  const encoder = new TextEncoder();
  const payloadObj = { sub: 'exp@lifeos.test', role: 'user', jti: 'test-jti-expired', iat: Date.now() - 10000, exp: Date.now() - 1000 };
  const payload = btoa(JSON.stringify(payloadObj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const key = await crypto.subtle.importKey('raw', encoder.encode(DEV_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const b64sig = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const expiredToken = `${payload}.${b64sig}`;
  const session = await verifySession(expiredToken, DEV_SECRET);
  check(session === null, 'token expirado deve retornar null');
});

await test('KV TTL expira entradas de sessão automaticamente', async () => {
  const kv = new MemoryKV();
  await kv.put('test-ttl-key', 'value', { expirationTtl: 0.001 }); // 1ms TTL
  await new Promise(r => setTimeout(r, 10));
  const val = await kv.get('test-ttl-key');
  check(val === null, 'entrada expirada deve retornar null do KV');
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 11 — SEGURANÇA E TRATAMENTO DE ERROS
// ─────────────────────────────────────────────────────────────────────────────

section('11. Segurança e Tratamento de Erros');

await test('token de um usuário não é válido para outro usuário', async () => {
  const t1 = await createSession('user1@lifeos.test', 'user', DEV_SECRET);
  const t2 = await createSession('user2@lifeos.test', 'user', DEV_SECRET);
  const s1 = await verifySession(t1, DEV_SECRET);
  const s2 = await verifySession(t2, DEV_SECRET);
  check(s1.sub !== s2.sub, 'tokens de usuários diferentes devem ter sub diferentes');
  check(s1.jti !== s2.jti, 'tokens de usuários diferentes devem ter JTI diferentes');
});

await test('token admin não pode ser forjado sem o secret correto', async () => {
  // Tentar criar token admin com secret errado
  const fakeToken = await createSession('hacker@lifeos.test', 'admin', 'wrong-secret');
  const session = await verifySession(fakeToken, DEV_SECRET);
  check(session === null, 'token forjado com secret errado deve ser rejeitado');
});

await test('payload adulterado é detectado (integridade HMAC)', async () => {
  const token = await createSession('integrity@lifeos.test', 'user', DEV_SECRET);
  const parts = token.split('.');
  // Decodificar e modificar o role para admin
  const decoded = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
  decoded.role = 'admin';
  const newPayload = btoa(JSON.stringify(decoded)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  // Usar a assinatura original (inválida para o novo payload)
  const tamperedToken = `${newPayload}.${parts[1]}`;
  const session = await verifySession(tamperedToken, DEV_SECRET);
  check(session === null, 'payload adulterado deve ser rejeitado pela verificação HMAC');
});

await test('injeção de caracteres especiais no username é sanitizada', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await postJson(loginPost, '/api/login', { email: '<script>alert(1)</script>@test.com', password: 'senha' }, env);
  check(result.status === 401 || result.status === 400, `injeção deve retornar 401 ou 400, recebeu ${result.status}`);
  check(result.body.ok === false, 'body.ok deve ser false');
});

await test('SQL injection attempt no campo email é tratado', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const result = await postJson(loginPost, '/api/login', { email: "' OR '1'='1", password: 'senha' }, env);
  check(result.status === 401 || result.status === 400, `SQL injection deve retornar 401 ou 400, recebeu ${result.status}`);
});

await test('body inválido (não-JSON) no login retorna 400', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);
  const request = makeRequest('/api/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: 'not-valid-json{{{',
  });
  const response = await loginPost({ request, env });
  check(response.status === 400, `esperado 400, recebeu ${response.status}`);
});

await test('revokeSession com KV nulo retorna false graciosamente', async () => {
  const result = await revokeSession(null, 'user@test.com', 'jti-123');
  check(result === false, 'revokeSession com KV nulo deve retornar false');
});

await test('revokeSession com sessionId nulo retorna false graciosamente', async () => {
  const kv = new MemoryKV();
  const result = await revokeSession(kv, 'user@test.com', null);
  check(result === false, 'revokeSession com sessionId nulo deve retornar false');
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCO 12 — FLUXO COMPLETO END-TO-END
// ─────────────────────────────────────────────────────────────────────────────

section('12. Fluxo Completo End-to-End');

await test('fluxo completo: login → verificar sessão → logout → sessão inválida', async () => {
  const kv = new MemoryKV();
  await seedUser(kv, DEV_USER_EMAIL, DEV_USER_PASS, 'user');
  const env = await makeEnv(kv);

  // 1. Login
  const loginResult = await postJson(loginPost, '/api/login', { email: DEV_USER_EMAIL, password: DEV_USER_PASS }, env);
  check(loginResult.status === 200, `[1] login deve retornar 200, recebeu ${loginResult.status}`);
  const token = loginResult.headers.get('set-cookie').match(/lifeos_session=([^;]+)/)[1];

  // 2. Verificar sessão
  const sessionResult = await getJson(sessionGet, '/api/session', env, token);
  check(sessionResult.status === 200, `[2] sessão deve ser válida, recebeu ${sessionResult.status}`);
  check(sessionResult.body.user?.username === DEV_USER_EMAIL, '[2] username deve corresponder');

  // 3. Acessar rota protegida /app
  const appResult = await middlewareRequest(appMiddleware, '/app/dashboard', env, token);
  check(appResult.nextCalled === true, '[3] middleware /app deve permitir acesso');

  // 4. Logout
  const logoutResult = await postJson(logoutPost, '/api/logout', {}, env, token);
  check(logoutResult.status === 200, `[4] logout deve retornar 200, recebeu ${logoutResult.status}`);

  // 5. Sessão inválida após logout
  const afterLogout = await getJson(sessionGet, '/api/session', env, token);
  check(afterLogout.status === 401, `[5] sessão deve ser inválida após logout, recebeu ${afterLogout.status}`);

  // 6. Rota protegida deve redirecionar após logout
  const appAfterLogout = await middlewareRequest(appMiddleware, '/app/dashboard', env, token);
  check(appAfterLogout.nextCalled === false, '[6] middleware /app deve bloquear após logout');
  check(appAfterLogout.status === 302, `[6] deve redirecionar, recebeu ${appAfterLogout.status}`);
});

await test('fluxo admin completo: admin-login → verificar admin-session → acesso /admin → logout', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);

  // 1. Admin login
  const loginResult = await postJson(adminLoginPost, '/api/admin-login', { username: DEV_ADMIN_USER, password: DEV_ADMIN_PASS }, env);
  check(loginResult.status === 200, `[1] admin login deve retornar 200, recebeu ${loginResult.status}`);
  const token = loginResult.headers.get('set-cookie').match(/lifeos_session=([^;]+)/)[1];

  // 2. Verificar admin-session
  const sessionResult = await getJson(adminSessionGet, '/api/admin-session', env, token);
  check(sessionResult.status === 200, `[2] admin-session deve ser válida, recebeu ${sessionResult.status}`);
  check(sessionResult.body.user?.role === 'admin', '[2] role deve ser admin');

  // 3. Acessar /admin
  const adminResult = await middlewareRequest(adminMiddleware, '/admin/dashboard', env, token);
  check(adminResult.nextCalled === true, '[3] middleware /admin deve permitir acesso a admin');

  // 4. Admin também pode acessar /app
  const appResult = await middlewareRequest(appMiddleware, '/app/dashboard', env, token);
  check(appResult.nextCalled === true, '[4] admin também pode acessar /app');

  // 5. Logout
  const logoutResult = await postJson(logoutPost, '/api/logout', {}, env, token);
  check(logoutResult.status === 200, `[5] logout deve retornar 200, recebeu ${logoutResult.status}`);

  // 6. Admin-session inválida após logout
  const afterLogout = await getJson(adminSessionGet, '/api/admin-session', env, token);
  check(afterLogout.status === 401, `[6] admin-session deve ser inválida após logout, recebeu ${afterLogout.status}`);
});

await test('fluxo RBAC: user não acessa /admin, admin acessa tudo', async () => {
  const kv = new MemoryKV();
  const env = await makeEnv(kv);

  const userToken = await createSession(DEV_USER_EMAIL, 'user', DEV_SECRET);
  const adminToken = await createSession(DEV_ADMIN_USER, 'admin', DEV_SECRET);

  // User não acessa /admin
  const userAdmin = await middlewareRequest(adminMiddleware, '/admin', env, userToken);
  check(userAdmin.nextCalled === false, 'user NÃO deve acessar /admin');
  check(userAdmin.status === 302, 'user deve ser redirecionado de /admin');

  // User acessa /app
  const userApp = await middlewareRequest(appMiddleware, '/app', env, userToken);
  check(userApp.nextCalled === true, 'user deve acessar /app');

  // Admin acessa /admin
  const adminAdmin = await middlewareRequest(adminMiddleware, '/admin', env, adminToken);
  check(adminAdmin.nextCalled === true, 'admin deve acessar /admin');

  // Admin acessa /app
  const adminApp = await middlewareRequest(appMiddleware, '/app', env, adminToken);
  check(adminApp.nextCalled === true, 'admin deve acessar /app');
});

// ─────────────────────────────────────────────────────────────────────────────
// RELATÓRIO FINAL
// ─────────────────────────────────────────────────────────────────────────────

const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║   RELATÓRIO DE HOMOLOGAÇÃO LOCAL — LifeOS Enterprise Auth       ║');
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log(`║   ✓ Aprovados:  ${String(passed).padEnd(4)} ${' '.repeat(47)}║`);
console.log(`║   ✗ Reprovados: ${String(failed).padEnd(4)} ${' '.repeat(47)}║`);
console.log(`║   Total:        ${String(passed + failed).padEnd(4)} ${' '.repeat(47)}║`);
console.log(`║   Tempo:        ${elapsed}s${' '.repeat(Math.max(0, 48 - elapsed.length))}║`);
console.log('╠══════════════════════════════════════════════════════════════════╣');
console.log('║   Ambiente:     DESENVOLVIMENTO ISOLADO (MemoryKV)              ║');
console.log('║   Produção:     NÃO ACESSADA                                    ║');
console.log('║   Dados reais:  NÃO UTILIZADOS                                  ║');
console.log('╚══════════════════════════════════════════════════════════════════╝');

if (failed > 0) {
  console.log('');
  console.log('Falhas detectadas:');
  results.filter(r => r.status !== 'PASS').forEach(r => {
    console.log(`  ✗ ${r.name}`);
    if (r.detail) console.log(`      → ${r.detail}`);
  });
}

// Saída estruturada para o relatório
const report = {
  timestamp: new Date().toISOString(),
  environment: 'development-isolated',
  production_accessed: false,
  real_data_used: false,
  results: { passed, failed, total: passed + failed, elapsed_seconds: parseFloat(elapsed) },
  tests: results,
};
console.log('');
console.log('JSON_REPORT:' + JSON.stringify(report));

process.exit(failed > 0 ? 1 : 0);
