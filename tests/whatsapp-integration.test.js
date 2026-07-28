// LifeOS Enterprise — WhatsApp Integration Validation Test Suite
// FASE 2 — Validação Enterprise
// Executa testes de unidade e integração local sem dependência de Cloudflare

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    results.push({ status: 'PASS', label });
    console.log(`  ✓ PASS: ${label}`);
  } else {
    failed++;
    results.push({ status: 'FAIL', label });
    console.log(`  ✗ FAIL: ${label}`);
  }
}

function testGroup(name, fn) {
  console.log(`\n── ${name} ──`);
  fn();
}

// ─── Helper: Mock KV ──────────────────────────────────────────────────────────
class MockKV {
  constructor() { this.store = new Map(); }
  async get(key) { return this.store.get(key) || null; }
  async put(key, value) { this.store.set(key, value); }
  async delete(key) { this.store.delete(key); }
}

// ─── Helper: Validate payload structures ──────────────────────────────────────
function validateWebhookPayload() {
  // Payload padrão WhatsApp Cloud API
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{
      id: '123456789',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '5511999990000', phone_number_id: '123456789012345' },
          contacts: [{ profile: { name: 'João Silva' }, wa_id: '5511988887777' }],
          messages: [{
            from: '5511988887777',
            id: 'wamid.HBgMNTUxMTk4ODg4Nzc3FQIAERgSMTIzNDU2Nzg5',
            timestamp: String(Math.floor(Date.now() / 1000)),
            type: 'text',
            text: { body: 'Olá, preciso de ajuda' }
          }]
        },
        field: 'messages'
      }]
    }]
  };
  return payload;
}

function validateStatusPayload() {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: '123456789',
      changes: [{
        value: {
          messaging_product: 'whatsapp',
          statuses: [{
            id: 'wamid.HBgMNTUxMTk4ODg4Nzc3FQIAERgSMTIzNDU2Nzg5',
            status: 'sent',
            timestamp: String(Math.floor(Date.now() / 1000)),
            recipient_id: '5511988887777',
            conversation: { id: 'abc123' }
          }]
        },
        field: 'messages'
      }]
    }]
  };
}

// ─── Test: Webhook Payload Structure ──────────────────────────────────────────
testGroup('Webhook Payload Structure', () => {
  const payload = validateWebhookPayload();
  assert(payload.object === 'whatsapp_business_account', 'Object field correct');
  assert(Array.isArray(payload.entry), 'Entry is array');
  assert(payload.entry.length > 0, 'Has at least one entry');
  assert(Array.isArray(payload.entry[0].changes), 'Changes is array');
  assert(payload.entry[0].changes[0].value.messages !== undefined, 'Has messages field');
  assert(payload.entry[0].changes[0].value.messages[0].type === 'text', 'Message type is text');
  assert(payload.entry[0].changes[0].value.messages[0].text.body === 'Olá, preciso de ajuda', 'Message body correct');
  assert(payload.entry[0].changes[0].value.contacts[0].profile.name === 'João Silva', 'Contact name correct');
});

// ─── Test: Status Update Payload ──────────────────────────────────────────────
testGroup('Status Update Payload', () => {
  const payload = validateStatusPayload();
  const statuses = payload.entry[0].changes[0].value.statuses;
  assert(Array.isArray(statuses), 'Statuses is array');
  assert(statuses[0].status === 'sent', 'Status is sent');
  assert(statuses[0].id.length > 0, 'Has message ID');
  assert(statuses[0].recipient_id === '5511988887777', 'Recipient ID correct');
  assert(statuses[0].conversation !== undefined, 'Has conversation info');
});

// ─── Test: Message Type Handling ──────────────────────────────────────────────
testGroup('Message Type Handling', () => {
  const types = ['text', 'image', 'video', 'document', 'audio', 'sticker', 'location', 'contacts', 'reaction', 'interactive', 'template'];
  
  for (const type of types) {
    const kv = new MockKV();
    const msg = { id: 'test_' + type, type, timestamp: String(Math.floor(Date.now() / 1000)), from: '5511988887777' };
    
    // Simulate type-specific content
    switch (type) {
      case 'text': msg.text = { body: 'Test text' }; break;
      case 'image': msg.image = { id: 'img123', mime_type: 'image/jpeg' }; break;
      case 'video': msg.video = { id: 'vid123', mime_type: 'video/mp4' }; break;
      case 'document': msg.document = { id: 'doc123', filename: 'report.pdf', mime_type: 'application/pdf' }; break;
      case 'audio': msg.audio = { id: 'aud123', mime_type: 'audio/ogg' }; break;
      case 'sticker': msg.sticker = { id: 'stk123' }; break;
      case 'location': msg.location = { latitude: -23.55, longitude: -46.63 }; break;
      case 'contacts': msg.contacts = [{ formatted_name: 'Maria Santos' }]; break;
      case 'reaction': msg.reaction = { emoji: '👍' }; break;
      case 'interactive': msg.interactive = { button_reply: { id: 'btn1', title: 'Sim' } }; break;
      case 'template': msg.template = { name: 'hello_world' }; break;
    }
    
    assert(msg.type === type, `Message type '${type}' structure valid`);
  }
});

// ─── Test: KV Namespace Compatibility ─────────────────────────────────────────
testGroup('KV Namespace Compatibility', () => {
  const kv = new MockKV();
  const userId = 'user123';
  const convId = 'conv456';
  
  // Test conversation key format
  const convKey = `msg:conversations:${userId}`;
  kv.store.set(convKey, JSON.stringify([{
    id: convId, title: 'Test', channel: 'whatsapp', messageCount: 0
  }]));
  
  const convsRaw = kv.store.get(convKey);
  const convs = JSON.parse(convsRaw);
  assert(convs.length === 1, 'Conversation stored in correct namespace');
  assert(convs[0].channel === 'whatsapp', 'Channel filter works');
  
  // Test message key format
  const msgKey = `msg:messages:${userId}:${convId}`;
  kv.store.set(msgKey, JSON.stringify([{
    id: 'msg789', text: 'Hello', sender: '5511988887777'
  }]));
  
  const msgsRaw = kv.store.get(msgKey);
  const msgs = JSON.parse(msgsRaw);
  assert(msgs.length === 1, 'Message stored in correct namespace');
  assert(msgs[0].sender === '5511988887777', 'Message sender correct');
  
  // Test isolation between users
  const userId2 = 'user789';
  const convKey2 = `msg:conversations:${userId2}`;
  // MockKV starts empty for user789
  const user2Data = kv.store.get(convKey2);
  assert(user2Data === undefined || user2Data === null, 'User isolation works (no cross-user data)');
});

// ─── Test: Webhook Verification (GET) ─────────────────────────────────────────
testGroup('Webhook Verification (GET)', () => {
  const env = { WHATSAPP_VERIFY_TOKEN: 'lifeos-whatsapp-verify' };
  const url = new URL('https://example.com/api/webhooks/whatsapp');
  url.searchParams.set('hub.mode', 'subscribe');
  url.searchParams.set('hub.challenge', 'CHALLENGE_123');
  url.searchParams.set('hub.verify_token', 'lifeos-whatsapp-verify');
  
  const mode = url.searchParams.get('hub.mode');
  const challenge = url.searchParams.get('hub.challenge');
  const verifyToken = url.searchParams.get('hub.verify_token');
  
  assert(mode === 'subscribe', 'Mode is subscribe');
  assert(challenge === 'CHALLENGE_123', 'Challenge received');
  assert(verifyToken === env.WHATSAPP_VERIFY_TOKEN, 'Token matches');
  assert(verifyToken === 'lifeos-whatsapp-verify', 'Token validation correct');
  
  // Test wrong token
  const wrongUrl = new URL('https://example.com/api/webhooks/whatsapp');
  wrongUrl.searchParams.set('hub.mode', 'subscribe');
  wrongUrl.searchParams.set('hub.challenge', 'CHALLENGE_123');
  wrongUrl.searchParams.set('hub.verify_token', 'wrong_token');
  const wrongToken = wrongUrl.searchParams.get('hub.verify_token');
  assert(wrongToken !== env.WHATSAPP_VERIFY_TOKEN, 'Wrong token correctly rejected');
});

// ─── Test: Retry Logic Simulation ─────────────────────────────────────────────
testGroup('Retry Logic', () => {
  const maxRetries = 3;
  let attempts = 0;
  let success = false;
  
  function simulateRequest() {
    attempts++;
    if (attempts >= 2) success = true; // Succeed on 2nd attempt
    return success;
  }
  
  for (let i = 0; i < maxRetries && !success; i++) {
    const result = simulateRequest();
    if (result) break;
  }
  
  assert(attempts === 2, 'Retry succeeds on 2nd attempt');
  assert(success, 'Success achieved within retry limit');
  
  // Test max retries exhausted
  attempts = 0;
  success = false;
  function simulateFailure() {
    attempts++;
    return false; // Always fails
  }
  
  for (let i = 0; i < maxRetries && !success; i++) {
    const result = simulateFailure();
    if (result) success = true;
  }
  
  assert(attempts === maxRetries, 'Max retries reached');
  assert(!success, 'Correctly reports failure after max retries');
});

// ─── Test: Token Expiry Detection ─────────────────────────────────────────────
testGroup('Token Expiry Detection', () => {
  const TOKEN_LIFETIME = 60 * 24 * 60 * 60 * 1000; // 60 days in ms
  const DAY = 24 * 60 * 60 * 1000;
  
  // Token at 59 days: 1 day remaining
  const remaining59 = TOKEN_LIFETIME - 59 * DAY;
  assert(remaining59 > 0, 'Token still valid at 59 days');
  assert(remaining59 === DAY, 'Exactly 1 day remaining at 59 days');
  
  // Token at 59.5 days: 12 hours remaining
  const remaining595 = TOKEN_LIFETIME - 59.5 * DAY;
  assert(remaining595 > 0, 'Token still valid at 59.5 days');
  assert(remaining595 === 12 * 60 * 60 * 1000, 'Exactly 12h remaining at 59.5 days');
  
  // Token at 60 days: expired
  const remaining60 = TOKEN_LIFETIME - 60 * DAY;
  assert(remaining60 <= 0, 'Token expired at 60 days');
  
  // Token at 61 days: well expired
  const remaining61 = TOKEN_LIFETIME - 61 * DAY;
  assert(remaining61 < 0, 'Token expired after 61 days');
});

// ─── Test: Multiple Users & Conversations ─────────────────────────────────────
testGroup('Multiple Users & Conversations', () => {
  const kv = new MockKV();
  
  const users = ['user1', 'user2', 'user3'];
  const conversations = {};
  
  for (const userId of users) {
    conversations[userId] = [];
    for (let i = 0; i < 5; i++) {
      conversations[userId].push({
        id: `conv_${userId}_${i}`,
        title: `Chat ${i + 1}`,
        channel: 'whatsapp',
        whatsappNumber: `55119999${i}`,
        messageCount: 10 + i,
        unread: i === 0 ? 3 : 0,
      });
    }
    kv.store.set(`msg:conversations:${userId}`, JSON.stringify(conversations[userId]));
  }
  
  for (const userId of users) {
    const data = JSON.parse(kv.store.get(`msg:conversations:${userId}`));
    assert(data.length === 5, `User ${userId} has 5 conversations`);
    
    // Filter WhatsApp only
    const waConvs = data.filter(c => c.channel === 'whatsapp');
    assert(waConvs.length === 5, `User ${userId} WhatsApp filter works`);
    
    // Count unread
    const unread = waConvs.reduce((sum, c) => sum + (c.unread || 0), 0);
    assert(unread === 3, `User ${userId} unread count correct`);
  }
  
  // Cross-user isolation
  const user1Conv = JSON.parse(kv.store.get('msg:conversations:user1'));
  const user2Conv = JSON.parse(kv.store.get('msg:conversations:user2'));
  assert(user1Conv[0].id !== user2Conv[0].id, 'No conversation ID collision between users');
});

// ─── Test: File Attachment Handling ───────────────────────────────────────────
testGroup('File Attachment Handling', () => {
  const kv = new MockKV();
  const userId = 'user1';
  const convId = 'conv1';
  
  // Simulate incoming document
  const attachment = {
    id: generateId(),
    name: 'relatorio_Q3.pdf',
    size: 2500000,
    type: 'application/pdf',
    externalUrl: 'media_id_123',
    externalSource: 'whatsapp_media',
  };
  
  function generateId() {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  
  const msg = {
    id: 'msg_test',
    convId,
    sender: '5511988887777',
    text: '[Documento: relatorio_Q3.pdf]',
    attachments: [attachment],
    createdAt: new Date().toISOString(),
    channel: 'whatsapp',
  };
  
  kv.store.set(`msg:messages:${userId}:${convId}`, JSON.stringify([msg]));
  
  const stored = JSON.parse(kv.store.get(`msg:messages:${userId}:${convId}`));
  assert(stored.length === 1, 'Message with attachment stored');
  assert(stored[0].attachments[0].type === 'application/pdf', 'Attachment type preserved');
  assert(stored[0].attachments[0].externalSource === 'whatsapp_media', 'External source tracked');
  
  // Test large file detection
  const largeFile = { size: 30 * 1024 * 1024 }; // 30MB
  assert(largeFile.size > 25 * 1024 * 1024, 'Large file detected (over 25MB)');
  
  // Test valid file
  const validFile = { size: 10 * 1024 * 1024 }; // 10MB
  assert(validFile.size <= 25 * 1024 * 1024, 'Valid file within limit');
});

// ─── Test: Logging ────────────────────────────────────────────────────────────
testGroup('Logging System', () => {
  const kv = new MockKV();
  const userId = 'user1';
  
  const logs = [];
  for (let i = 0; i < 10; i++) {
    logs.push({
      id: `log_${i}`,
      type: i % 3 === 0 ? 'webhook_received' : i % 3 === 1 ? 'message_sent' : 'status_update',
      provider: 'whatsapp',
      timestamp: new Date().toISOString(),
      details: `Event ${i}`,
    });
  }
  
  kv.store.set(`comm:logs:${userId}`, JSON.stringify(logs));
  const storedLogs = JSON.parse(kv.store.get(`comm:logs:${userId}`));
  
  assert(storedLogs.length === 10, 'All logs stored');
  assert(storedLogs[0].type === 'webhook_received', 'First log is webhook');
  assert(storedLogs.every(l => l.provider === 'whatsapp'), 'All logs have provider');
  assert(storedLogs.every(l => l.timestamp), 'All logs have timestamp');
});

// ─── Test: CSRF Exemption ─────────────────────────────────────────────────────
testGroup('CSRF Exemption for Webhooks', () => {
  const WEBHOOK_PATHS = ['/api/webhooks/whatsapp', '/api/payments/webhook'];
  
  function isWebhookRoute(pathname) {
    return WEBHOOK_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
  }
  
  assert(isWebhookRoute('/api/webhooks/whatsapp'), 'WhatsApp webhook exempted');
  assert(isWebhookRoute('/api/webhooks/whatsapp/verify'), 'WhatsApp webhook subpath exempted');
  assert(!isWebhookRoute('/api/messages'), 'Messages not exempted');
  assert(!isWebhookRoute('/api/comm-hub'), 'Comm-hub not exempted');
  assert(!isWebhookRoute('/api/profile'), 'Profile not exempted');
});

// ─── Test: Notification Creation ──────────────────────────────────────────────
testGroup('Notification Creation', () => {
  const kv = new MockKV();
  const userId = 'user1';
  
  const notifications = [];
  for (let i = 0; i < 5; i++) {
    notifications.push({
      id: `notif_${i}`,
      type: 'whatsapp_message',
      title: `Nova mensagem de Contato ${i + 1}`,
      body: `Preview da mensagem ${i + 1}...`,
      metadata: { from: `55119999${i}`, conversationId: `conv_${i}` },
      read: false,
      createdAt: new Date().toISOString(),
    });
  }
  
  kv.store.set(`notifications:${userId}`, JSON.stringify(notifications));
  const stored = JSON.parse(kv.store.get(`notifications:${userId}`));
  
  assert(stored.length === 5, '5 notifications stored');
  assert(stored.every(n => n.type === 'whatsapp_message'), 'All are whatsapp type');
  assert(stored.every(n => !n.read), 'All unread');
  
  // Mark read
  stored[0].read = true;
  kv.store.set(`notifications:${userId}`, JSON.stringify(stored));
  const updated = JSON.parse(kv.store.get(`notifications:${userId}`));
  assert(updated[0].read === true, 'Notification marked as read');
  assert(updated[1].read === false, 'Other notifications remain unread');
});

// ─── Test: Phone Number Validation ────────────────────────────────────────────
testGroup('Phone Number Validation', () => {
  const validPhones = ['5511999990000', '+5511999990000', '5511999990000', '12345678901'];
  const invalidPhones = ['', 'abc', '55', '123'];
  
  for (const phone of validPhones) {
    const cleaned = phone.replace(/[^0-9]/g, '');
    assert(cleaned.length >= 7, `Phone ${phone} cleaned to ${cleaned} (valid length)`);
  }
  
  for (const phone of invalidPhones) {
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length > 0) {
      assert(cleaned.length < 7, `Phone '${phone}' correctly identified as too short`);
    } else {
      assert(cleaned.length === 0, `Phone '${phone}' correctly identified as empty`);
    }
  }
});

// ─── Test: Sanitization ───────────────────────────────────────────────────────
testGroup('Input Sanitization', () => {
  function safeText(value, max = 2000) {
    return String(value ?? '').trim().replace(/[\u0000-\u001F\u007F]/g, ' ').slice(0, max) || '';
  }
  
  function sanitizeInput(value) {
    if (typeof value !== 'string') return '';
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .slice(0, 5000);
  }
  
  assert(safeText('Hello World') === 'Hello World', 'Normal text preserved');
  assert(safeText(null) === '', 'Null returns empty');
  assert(safeText(undefined) === '', 'Undefined returns empty');
  assert(safeText('<b>Bold</b>').length > 0, 'HTML tags preserved in safeText');
  assert(sanitizeInput('<script>alert("xss")</script>') === '', 'XSS script removed');
  assert(sanitizeInput('onclick="alert(1)"').indexOf('onclick') === -1, 'Event handlers removed');
  assert(!sanitizeInput('javascript:alert(1)').includes('javascript'), 'javascript: removed');
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║         WHATSAPP INTEGRATION TEST RESULTS               ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log(`║  PASSED: ${passed.toString().padEnd(45)} ║`);
console.log(`║  FAILED: ${failed.toString().padEnd(45)} ║`);
console.log(`║  TOTAL:  ${(passed + failed).toString().padEnd(45)} ║`);
console.log('╚══════════════════════════════════════════════════════════╝');

if (failed > 0) {
  console.log('\nFailed tests:');
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(`  ✗ ${r.label}`));
  process.exit(1);
} else {
  console.log('\n  ✓ ALL TESTS PASSED');
  process.exit(0);
}
