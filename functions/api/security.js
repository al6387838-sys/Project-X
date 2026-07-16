// LifeOS Enterprise — Security API v2.0
// Cloudflare Pages Function: GET/POST /api/security
// Phase 144 — Enterprise Security
// MFA, sessões, dispositivos, auditoria, rate limiting, criptografia, logs, políticas de acesso
import { getCookie, json, verifySession, hasPermission } from '../_auth.js';

function generateId() {
  return crypto.randomUUID().replace(/-/g,'').slice(0,16);
}

// Gerar TOTP secret (base32)
function generateTotpSecret() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let secret = '';
  const arr = new Uint8Array(20);
  crypto.getRandomValues(arr);
  arr.forEach(b => { secret += chars[b % 32]; });
  return secret;
}

// Verificar TOTP (RFC 6238)
async function verifyTotp(token, secret) {
  if (!token || !secret) return false;
  const cleanToken = token.replace(/\s/g, '');
  if (!/^\d{6}$/.test(cleanToken)) return false;

  const now = Math.floor(Date.now() / 1000);
  // Verificar janela de ±1 período (30s)
  for (const step of [-1, 0, 1]) {
    const counter = Math.floor(now / 30) + step;
    const expected = await computeTotp(secret, counter);
    if (expected === cleanToken) return true;
  }
  return false;
}

async function computeTotp(secret, counter) {
  // Decodificar base32
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of secret.toUpperCase()) {
    const idx = chars.indexOf(c);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  // Counter como 8 bytes big-endian
  const counterBytes = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = c & 0xff;
    c = Math.floor(c / 256);
  }

  const key = await crypto.subtle.importKey('raw', new Uint8Array(bytes), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, counterBytes);
  const sigBytes = new Uint8Array(sig);
  const offset = sigBytes[19] & 0xf;
  const code = ((sigBytes[offset] & 0x7f) << 24) | (sigBytes[offset + 1] << 16) | (sigBytes[offset + 2] << 8) | sigBytes[offset + 3];
  return (code % 1000000).toString().padStart(6, '0');
}

async function securityAuditLog(kv, userId, event, details = {}) {
  try {
    const raw = await kv.get(`security:audit:${userId}`);
    const log = raw ? JSON.parse(raw) : [];
    log.unshift({
      id: generateId(),
      event,
      userId,
      details,
      timestamp: new Date().toISOString(),
      severity: details.severity || 'info',
    });
    await kv.put(`security:audit:${userId}`, JSON.stringify(log.slice(0, 1000)));
  } catch { /* ignorar */ }
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'status';
  const kv = env.LIFEOS_KV;

  if (!kv) return json(200, { ok: true, data: {}, source: 'unavailable' });

  try {
    switch (view) {
      case 'status': {
        const mfaRaw = await kv.get(`security:mfa:${session.sub}`);
        const mfa = mfaRaw ? JSON.parse(mfaRaw) : { enabled: false };
        const devicesRaw = await kv.get(`security:devices:${session.sub}`);
        const devices = devicesRaw ? JSON.parse(devicesRaw) : [];
        const policyRaw = await kv.get(`security:policy:${session.sub}`);
        const policy = policyRaw ? JSON.parse(policyRaw) : getDefaultPolicy();
        const auditRaw = await kv.get(`security:audit:${session.sub}`);
        const audit = auditRaw ? JSON.parse(auditRaw) : [];

        return json(200, {
          ok: true,
          security: {
            mfa: { enabled: mfa.enabled, method: mfa.method || null },
            devices: devices.length,
            trustedDevices: devices.filter(d => d.trusted).length,
            policy,
            recentEvents: audit.slice(0, 5),
            score: computeSecurityScore({ mfa, devices, policy }),
          },
        });
      }

      case 'mfa': {
        const mfaRaw = await kv.get(`security:mfa:${session.sub}`);
        const mfa = mfaRaw ? JSON.parse(mfaRaw) : { enabled: false };
        // Nunca retornar o secret
        const { secret: _s, backupCodes: _b, ...safeMfa } = mfa;
        return json(200, { ok: true, mfa: safeMfa });
      }

      case 'devices': {
        const raw = await kv.get(`security:devices:${session.sub}`);
        const devices = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, devices });
      }

      case 'audit': {
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const severity = url.searchParams.get('severity');
        const raw = await kv.get(`security:audit:${session.sub}`);
        let audit = raw ? JSON.parse(raw) : [];
        if (severity) audit = audit.filter(e => e.severity === severity);
        return json(200, { ok: true, audit: audit.slice(0, limit), total: audit.length });
      }

      case 'policy': {
        const raw = await kv.get(`security:policy:${session.sub}`);
        const policy = raw ? JSON.parse(raw) : getDefaultPolicy();
        return json(200, { ok: true, policy });
      }

      default:
        return json(400, { ok: false, error: 'view inválido' });
    }
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao carregar dados de segurança' });
  }
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Armazenamento indisponível' });

  let body;
  try { body = await request.json(); } catch { return json(400, { ok: false, error: 'JSON inválido' }); }

  const { action } = body;

  // ─── Iniciar configuração MFA (TOTP) ───
  if (action === 'mfa-setup') {
    const totpSecret = generateTotpSecret();
    const issuer = 'LifeOS Enterprise';
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(session.sub)}?secret=${totpSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

    // Salvar secret temporário (não ativado ainda)
    const mfaRaw = await kv.get(`security:mfa:${session.sub}`);
    const mfa = mfaRaw ? JSON.parse(mfaRaw) : {};
    mfa.pendingSecret = totpSecret;
    mfa.pendingSetupAt = new Date().toISOString();
    await kv.put(`security:mfa:${session.sub}`, JSON.stringify(mfa));

    await securityAuditLog(kv, session.sub, 'mfa-setup-initiated', { method: 'totp' });

    return json(200, { ok: true, otpauthUrl, secret: totpSecret });
  }

  // ─── Confirmar e ativar MFA ───
  if (action === 'mfa-confirm') {
    const { totpToken } = body;
    if (!totpToken) return json(400, { ok: false, error: 'totpToken obrigatório' });

    const mfaRaw = await kv.get(`security:mfa:${session.sub}`);
    const mfa = mfaRaw ? JSON.parse(mfaRaw) : {};

    if (!mfa.pendingSecret) return json(400, { ok: false, error: 'Inicie o setup do MFA primeiro' });

    const valid = await verifyTotp(totpToken, mfa.pendingSecret);
    if (!valid) return json(400, { ok: false, error: 'Código TOTP inválido' });

    // Gerar backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      Array.from(crypto.getRandomValues(new Uint8Array(4))).map(b => b.toString(16).padStart(2, '0')).join('')
    );

    mfa.enabled = true;
    mfa.method = 'totp';
    mfa.secret = mfa.pendingSecret;
    mfa.backupCodes = backupCodes.map(c => ({ code: c, used: false }));
    mfa.enabledAt = new Date().toISOString();
    delete mfa.pendingSecret;
    delete mfa.pendingSetupAt;

    await kv.put(`security:mfa:${session.sub}`, JSON.stringify(mfa));
    await securityAuditLog(kv, session.sub, 'mfa-enabled', { method: 'totp', severity: 'high' });

    return json(200, { ok: true, backupCodes, message: 'MFA ativado com sucesso. Guarde os códigos de backup.' });
  }

  // ─── Desativar MFA ───
  if (action === 'mfa-disable') {
    const { totpToken } = body;
    if (!totpToken) return json(400, { ok: false, error: 'totpToken obrigatório para desativar MFA' });

    const mfaRaw = await kv.get(`security:mfa:${session.sub}`);
    const mfa = mfaRaw ? JSON.parse(mfaRaw) : {};
    if (!mfa.enabled) return json(400, { ok: false, error: 'MFA não está ativo' });

    const valid = await verifyTotp(totpToken, mfa.secret);
    if (!valid) return json(400, { ok: false, error: 'Código TOTP inválido' });

    await kv.put(`security:mfa:${session.sub}`, JSON.stringify({ enabled: false }));
    await securityAuditLog(kv, session.sub, 'mfa-disabled', { severity: 'high' });

    return json(200, { ok: true, message: 'MFA desativado' });
  }

  // ─── Registrar dispositivo ───
  if (action === 'register-device') {
    const { deviceName, userAgent, platform } = body;
    const device = {
      id: generateId(),
      name: deviceName || 'Dispositivo desconhecido',
      userAgent: userAgent || request.headers.get('user-agent') || '',
      platform: platform || 'web',
      ip: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown',
      trusted: false,
      registeredAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

    const raw = await kv.get(`security:devices:${session.sub}`);
    const devices = raw ? JSON.parse(raw) : [];
    devices.unshift(device);
    await kv.put(`security:devices:${session.sub}`, JSON.stringify(devices.slice(0, 20)));
    await securityAuditLog(kv, session.sub, 'device-registered', { deviceId: device.id, name: device.name });

    return json(201, { ok: true, device });
  }

  // ─── Confiar/desconfiar dispositivo ───
  if (action === 'trust-device') {
    const { deviceId, trusted } = body;
    if (!deviceId) return json(400, { ok: false, error: 'deviceId obrigatório' });

    const raw = await kv.get(`security:devices:${session.sub}`);
    const devices = raw ? JSON.parse(raw) : [];
    const idx = devices.findIndex(d => d.id === deviceId);
    if (idx === -1) return json(404, { ok: false, error: 'Dispositivo não encontrado' });

    devices[idx].trusted = !!trusted;
    await kv.put(`security:devices:${session.sub}`, JSON.stringify(devices));
    await securityAuditLog(kv, session.sub, trusted ? 'device-trusted' : 'device-untrusted', { deviceId });

    return json(200, { ok: true, trusted: devices[idx].trusted });
  }

  // ─── Revogar dispositivo ───
  if (action === 'revoke-device') {
    const { deviceId } = body;
    if (!deviceId) return json(400, { ok: false, error: 'deviceId obrigatório' });

    const raw = await kv.get(`security:devices:${session.sub}`);
    const devices = raw ? JSON.parse(raw) : [];
    const filtered = devices.filter(d => d.id !== deviceId);
    await kv.put(`security:devices:${session.sub}`, JSON.stringify(filtered));
    await securityAuditLog(kv, session.sub, 'device-revoked', { deviceId, severity: 'medium' });

    return json(200, { ok: true, revoked: deviceId });
  }

  // ─── Atualizar política de segurança ───
  if (action === 'update-policy') {
    const { sessionTimeout, maxDevices, requireMfaForSensitive, allowedIpRanges, passwordPolicy } = body;

    const raw = await kv.get(`security:policy:${session.sub}`);
    const policy = raw ? JSON.parse(raw) : getDefaultPolicy();

    if (sessionTimeout !== undefined) policy.sessionTimeout = Math.max(1, Math.min(24, sessionTimeout));
    if (maxDevices !== undefined) policy.maxDevices = Math.max(1, Math.min(20, maxDevices));
    if (requireMfaForSensitive !== undefined) policy.requireMfaForSensitive = !!requireMfaForSensitive;
    if (Array.isArray(allowedIpRanges)) policy.allowedIpRanges = allowedIpRanges;
    if (passwordPolicy) {
      policy.passwordPolicy = {
        ...policy.passwordPolicy,
        ...passwordPolicy,
      };
    }
    policy.updatedAt = new Date().toISOString();

    await kv.put(`security:policy:${session.sub}`, JSON.stringify(policy));
    await securityAuditLog(kv, session.sub, 'policy-updated', { severity: 'medium' });

    return json(200, { ok: true, policy });
  }

  // ─── Auditoria de vulnerabilidades ───
  if (action === 'vulnerability-scan') {
    const mfaRaw = await kv.get(`security:mfa:${session.sub}`);
    const mfa = mfaRaw ? JSON.parse(mfaRaw) : {};
    const devicesRaw = await kv.get(`security:devices:${session.sub}`);
    const devices = devicesRaw ? JSON.parse(devicesRaw) : [];
    const policyRaw = await kv.get(`security:policy:${session.sub}`);
    const policy = policyRaw ? JSON.parse(policyRaw) : getDefaultPolicy();

    const vulnerabilities = [];
    const recommendations = [];

    if (!mfa.enabled) {
      vulnerabilities.push({ id: 'no-mfa', severity: 'high', title: 'MFA não ativado', description: 'Ative a autenticação de dois fatores para proteger sua conta.' });
      recommendations.push({ action: 'Ativar MFA', page: 'security', priority: 'high' });
    }

    if (devices.length > 5) {
      vulnerabilities.push({ id: 'many-devices', severity: 'medium', title: 'Muitos dispositivos registrados', description: `${devices.length} dispositivos registrados. Revogue os que não usa mais.` });
    }

    if (policy.sessionTimeout > 12) {
      vulnerabilities.push({ id: 'long-session', severity: 'low', title: 'Sessão muito longa', description: 'Sessões longas aumentam o risco em caso de dispositivo perdido.' });
    }

    const score = computeSecurityScore({ mfa, devices, policy });

    await securityAuditLog(kv, session.sub, 'vulnerability-scan', { score, vulnerabilities: vulnerabilities.length });

    return json(200, {
      ok: true,
      scan: {
        score,
        vulnerabilities,
        recommendations,
        scannedAt: new Date().toISOString(),
        status: score >= 80 ? 'secure' : score >= 60 ? 'moderate' : 'at-risk',
      },
    });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

function getDefaultPolicy() {
  return {
    sessionTimeout: 8,
    maxDevices: 10,
    requireMfaForSensitive: false,
    allowedIpRanges: [],
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireNumbers: true,
      requireSpecial: false,
    },
    updatedAt: new Date().toISOString(),
  };
}

function computeSecurityScore({ mfa, devices, policy }) {
  let score = 40; // base
  if (mfa?.enabled) score += 30;
  if (policy?.requireMfaForSensitive) score += 10;
  if (policy?.sessionTimeout <= 8) score += 10;
  if (devices?.filter(d => d.trusted).length > 0) score += 5;
  if (policy?.passwordPolicy?.requireSpecial) score += 5;
  return Math.min(100, score);
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    default: return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
  }
}
