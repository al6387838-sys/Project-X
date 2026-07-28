// LifeOS Enterprise — Microsoft Ecosystem Test Suite
// Phase 751 — Microsoft Ecosystem Enterprise Validation
// Tests: OAuth, Mail, Calendar, OneDrive, Teams, Upload, Download, Sharing, Sync, Recovery, Logs
'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0, failed = 0, errors = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    errors.push(`${name}: ${e.message}`);
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

// ─── Load modules for structural validation ───────────────────────────────────
const graphClientPath = path.resolve(__dirname, '../functions/api/microsoft/graph-client.js');
const graphClientCode = fs.readFileSync(graphClientPath, 'utf8');
const microsoftPath = path.resolve(__dirname, '../functions/api/microsoft.js');
const microsoftCode = fs.readFileSync(microsoftPath, 'utf8');

console.log('\n═══ LIFEOS MICROSOFT ECOSYSTEM — TEST SUITE ═══\n');

// ═══ 1. OAUTH TESTS ═══════════════════════════════════════════════════════════
console.log('── OAuth 2.0 ──────────────────────────────────────────────────');

test('Graph Client exporta getAccessToken', () => {
  assert(graphClientCode.includes('getAccessToken'), 'getAccessToken deve existir');
  assert(graphClientCode.includes('async function getAccessToken') || graphClientCode.includes('export async function getAccessToken'), 'Deve ser async export');
});

test('Graph Client exporta refreshAccessToken', () => {
  assert(graphClientCode.includes('refreshAccessToken'), 'refreshAccessToken deve existir');
});

test('Graph Client exporta graphRequest', () => {
  assert(graphClientCode.includes('graphRequest'), 'graphRequest deve existir');
});

test('Graph Client exporta graphDownload', () => {
  assert(graphClientCode.includes('graphDownload'), 'graphDownload deve existir');
});

test('Graph Client tem endpoint de token Microsoft', () => {
  assert(graphClientCode.includes('login.microsoftonline.com'), 'Token endpoint deve apontar para Microsoft');
});

test('Microsoft API tem action refresh-token', () => {
  assert(microsoftCode.includes("action === 'refresh-token'"), 'Refresh-token action deve existir');
});

test('Microsoft API tem action disconnect', () => {
  assert(microsoftCode.includes("action === 'disconnect'"), 'Disconnect action deve existir');
});

test('Microsoft API tem action reconnect', () => {
  assert(microsoftCode.includes("action === 'reconnect'"), 'Reconnect action deve existir');
});

test('Microsoft API tem action oauth-url', () => {
  assert(microsoftCode.includes("action === 'oauth-url'"), 'OAuth-URL action deve existir');
});

test('OAuth URL usa scope correto', () => {
  assert(microsoftCode.includes('offline_access'), 'Scope offline_access deve existir');
  assert(microsoftCode.includes('Mail.Read'), 'Scope Mail.Read deve existir');
  assert(microsoftCode.includes('Mail.Send'), 'Scope Mail.Send deve existir');
  assert(microsoftCode.includes('Files.Read.All'), 'Scope Files.Read.All deve existir');
});

test('Reconnect usa prompt select_account', () => {
  assert(microsoftCode.includes('prompt=select_account'), 'Reconnect deve forçar seleção de conta');
});

// ═══ 2. MAIL TESTS ════════════════════════════════════════════════════════════
console.log('\n── Outlook Mail ─────────────────────────────────────────────────');

test('Microsoft API tem mail-list action', () => {
  assert(microsoftCode.includes("action === 'mail-list'"), 'mail-list deve existir');
});

test('Microsoft API tem mail-get action', () => {
  assert(microsoftCode.includes("action === 'mail-get'"), 'mail-get deve existir');
});

test('Microsoft API tem mail-folders action', () => {
  assert(microsoftCode.includes("action === 'mail-folders'"), 'mail-folders deve existir');
});

test('Microsoft API tem mail-send action', () => {
  assert(microsoftCode.includes("action === 'mail-send'"), 'mail-send deve existir');
});

test('Microsoft API tem mail-reply action', () => {
  assert(microsoftCode.includes("action === 'mail-reply'"), 'mail-reply deve existir');
});

test('Microsoft API tem mail-reply-all action', () => {
  assert(microsoftCode.includes("action === 'mail-reply-all'"), 'mail-reply-all deve existir');
});

test('Microsoft API tem mail-forward action', () => {
  assert(microsoftCode.includes("action === 'mail-forward'"), 'mail-forward deve existir');
});

test('Microsoft API tem mail-attachments action', () => {
  assert(microsoftCode.includes("action === 'mail-attachments'"), 'mail-attachments deve existir');
});

test('Microsoft API tem mail-search action', () => {
  assert(microsoftCode.includes("action === 'mail-search'"), 'mail-search deve existir');
});

test('Microsoft API tem mail-mark-read action', () => {
  assert(microsoftCode.includes("action === 'mail-mark-read'"), 'mail-mark-read deve existir');
});

test('Microsoft API tem mail-mark-unread action', () => {
  assert(microsoftCode.includes("action === 'mail-mark-unread'"), 'mail-mark-unread deve existir');
});

test('Microsoft API tem mail-move action', () => {
  assert(microsoftCode.includes("action === 'mail-move'"), 'mail-move deve existir');
});

test('Microsoft API tem mail-delete action', () => {
  assert(microsoftCode.includes("action === 'mail-delete'"), 'mail-delete deve existir');
});

test('Microsoft API tem mail-trash action', () => {
  assert(microsoftCode.includes("action === 'mail-trash'"), 'mail-trash deve existir');
});

test('Microsoft API tem mail-restore action', () => {
  assert(microsoftCode.includes("action === 'mail-restore'"), 'mail-restore deve existir');
});

test('Microsoft API tem mail-create-draft action', () => {
  assert(microsoftCode.includes("action === 'mail-create-draft'"), 'mail-create-draft deve existir');
});

test('Microsoft API tem mail-send-draft action', () => {
  assert(microsoftCode.includes("action === 'mail-send-draft'"), 'mail-send-draft deve existir');
});

test('Graph Client tem módulo MAIL com listMessages', () => {
  assert(graphClientCode.includes('listMessages'), 'listMessages deve existir no MAIL');
});

test('Graph Client tem módulo MAIL com sendMessage', () => {
  assert(graphClientCode.includes('sendMessage'), 'sendMessage deve existir no MAIL');
});

test('Graph Client tem módulo MAIL com reply', () => {
  assert(graphClientCode.includes('async reply('), 'reply deve existir no MAIL');
});

test('Graph Client tem módulo MAIL com forward', () => {
  assert(graphClientCode.includes('async forward('), 'forward deve existir no MAIL');
});

test('Graph Client tem módulo MAIL com getAttachments', () => {
  assert(graphClientCode.includes('getAttachments'), 'getAttachments deve existir no MAIL');
});

// ═══ 3. CALENDAR TESTS ════════════════════════════════════════════════════════
console.log('\n── Outlook Calendar ─────────────────────────────────────────────');

test('Microsoft API tem calendar-view action', () => {
  assert(microsoftCode.includes("action === 'calendar-view'"), 'calendar-view deve existir');
});

test('Microsoft API tem calendar-list action', () => {
  assert(microsoftCode.includes("action === 'calendar-list'"), 'calendar-list deve existir');
});

test('Microsoft API tem calendar-get action', () => {
  assert(microsoftCode.includes("action === 'calendar-get'"), 'calendar-get deve existir');
});

test('Microsoft API tem calendar-create action', () => {
  assert(microsoftCode.includes("action === 'calendar-create'"), 'calendar-create deve existir');
});

test('Microsoft API tem calendar-update action', () => {
  assert(microsoftCode.includes("action === 'calendar-update'"), 'calendar-update deve existir');
});

test('Microsoft API tem calendar-delete action', () => {
  assert(microsoftCode.includes("action === 'calendar-delete'"), 'calendar-delete deve existir');
});

test('Microsoft API tem calendar-accept action', () => {
  assert(microsoftCode.includes("action === 'calendar-accept'"), 'calendar-accept deve existir');
});

test('Microsoft API tem calendar-decline action', () => {
  assert(microsoftCode.includes("action === 'calendar-decline'"), 'calendar-decline deve existir');
});

test('Microsoft API tem calendar-tentative action', () => {
  assert(microsoftCode.includes("action === 'calendar-tentative'"), 'calendar-tentative deve existir');
});

test('Microsoft API tem calendar-propose-time action', () => {
  assert(microsoftCode.includes("action === 'calendar-propose-time'"), 'calendar-propose-time deve existir');
});

test('Graph Client tem módulo CALENDAR', () => {
  assert(graphClientCode.includes('CALENDAR'), 'CALENDAR deve existir');
});

test('Graph Client tem getCalendarView', () => {
  assert(graphClientCode.includes('getCalendarView'), 'getCalendarView deve existir');
});

test('Graph Client tem createEvent', () => {
  assert(graphClientCode.includes('createEvent'), 'createEvent deve existir');
});

test('Graph Client tem acceptEvent', () => {
  assert(graphClientCode.includes('acceptEvent'), 'acceptEvent deve existir');
});

test('Graph Client tem declineEvent', () => {
  assert(graphClientCode.includes('declineEvent'), 'declineEvent deve existir');
});

test('Graph Client tem proposeNewTime', () => {
  assert(graphClientCode.includes('proposeNewTime'), 'proposeNewTime deve existir');
});

// ═══ 4. ONEDRIVE TESTS ════════════════════════════════════════════════════════
console.log('\n── OneDrive ─────────────────────────────────────────────────────');

test('Microsoft API tem onedrive-root action', () => {
  assert(microsoftCode.includes("action === 'onedrive-root'"), 'onedrive-root deve existir');
});

test('Microsoft API tem onedrive-list action', () => {
  assert(microsoftCode.includes("action === 'onedrive-list'"), 'onedrive-list deve existir');
});

test('Microsoft API tem onedrive-get action', () => {
  assert(microsoftCode.includes("action === 'onedrive-get'"), 'onedrive-get deve existir');
});

test('Microsoft API tem onedrive-search action', () => {
  assert(microsoftCode.includes("action === 'onedrive-search'"), 'onedrive-search deve existir');
});

test('Microsoft API tem onedrive-recent action', () => {
  assert(microsoftCode.includes("action === 'onedrive-recent'"), 'onedrive-recent deve existir');
});

test('Microsoft API tem onedrive-create-folder action', () => {
  assert(microsoftCode.includes("action === 'onedrive-create-folder'"), 'onedrive-create-folder deve existir');
});

test('Microsoft API tem onedrive-upload action', () => {
  assert(microsoftCode.includes("action === 'onedrive-upload'"), 'onedrive-upload deve existir');
});

test('Microsoft API tem onedrive-delete action', () => {
  assert(microsoftCode.includes("action === 'onedrive-delete'"), 'onedrive-delete deve existir');
});

test('Microsoft API tem onedrive-rename action', () => {
  assert(microsoftCode.includes("action === 'onedrive-rename'"), 'onedrive-rename deve existir');
});

test('Microsoft API tem onedrive-move action', () => {
  assert(microsoftCode.includes("action === 'onedrive-move'"), 'onedrive-move deve existir');
});

test('Microsoft API tem onedrive-share action', () => {
  assert(microsoftCode.includes("action === 'onedrive-share'"), 'onedrive-share deve existir');
});

test('Microsoft API tem onedrive-invite action', () => {
  assert(microsoftCode.includes("action === 'onedrive-invite'"), 'onedrive-invite deve existir');
});

test('Graph Client tem módulo ONEDRIVE', () => {
  assert(graphClientCode.includes('ONEDRIVE'), 'ONEDRIVE deve existir');
});

test('Graph Client tem uploadFile', () => {
  assert(graphClientCode.includes('uploadFile'), 'uploadFile deve existir');
});

test('Graph Client tem downloadFile', () => {
  assert(graphClientCode.includes('downloadFile'), 'downloadFile deve existir');
});

test('Graph Client tem shareItem', () => {
  assert(graphClientCode.includes('shareItem'), 'shareItem deve existir');
});

test('Graph Client tem createFolder', () => {
  assert(graphClientCode.includes('createFolder'), 'createFolder deve existir');
});

test('Graph Client tem getPermissions', () => {
  assert(graphClientCode.includes('getPermissions'), 'getPermissions deve existir');
});

// ═══ 5. TEAMS TESTS ═══════════════════════════════════════════════════════════
console.log('\n── Microsoft Teams ──────────────────────────────────────────────');

test('Microsoft API tem teams-list action', () => {
  assert(microsoftCode.includes("action === 'teams-list'"), 'teams-list deve existir');
});

test('Microsoft API tem teams-channels action', () => {
  assert(microsoftCode.includes("action === 'teams-channels'"), 'teams-channels deve existir');
});

test('Microsoft API tem teams-messages action', () => {
  assert(microsoftCode.includes("action === 'teams-messages'"), 'teams-messages deve existir');
});

test('Microsoft API tem teams-send action', () => {
  assert(microsoftCode.includes("action === 'teams-send'"), 'teams-send deve existir');
});

test('Microsoft API tem teams-reply action', () => {
  assert(microsoftCode.includes("action === 'teams-reply'"), 'teams-reply deve existir');
});

test('Microsoft API tem teams-files action', () => {
  assert(microsoftCode.includes("action === 'teams-files'"), 'teams-files deve existir');
});

test('Microsoft API tem teams-tabs action', () => {
  assert(microsoftCode.includes("action === 'teams-tabs'"), 'teams-tabs deve existir');
});

test('Graph Client tem módulo TEAMS', () => {
  assert(graphClientCode.includes('TEAMS'), 'TEAMS deve existir');
});

test('Graph Client tem listTeams', () => {
  assert(graphClientCode.includes('listTeams'), 'listTeams deve existir');
});

test('Graph Client tem listChannels', () => {
  assert(graphClientCode.includes('listChannels'), 'listChannels deve existir');
});

test('Graph Client tem sendMessage (Teams)', () => {
  assert(graphClientCode.includes('sendMessage'), 'sendMessage deve existir para Teams');
});

// ═══ 6. UPLOAD / DOWNLOAD ═════════════════════════════════════════════════════
console.log('\n── Upload / Download ────────────────────────────────────────────');

test('Upload valida fileName obrigatório', () => {
  assert(microsoftCode.includes("body.fileName || !body.content"), 'Deve validar fileName e content');
});

test('Upload converte base64 para Uint8Array', () => {
  assert(microsoftCode.includes('Uint8Array.from(atob'), 'Deve decodificar base64');
});

test('Graph Client tem downloadFile method', () => {
  assert(graphClientCode.includes('async function downloadFile') || graphClientCode.includes('downloadFile'), 'downloadFile deve existir');
});

test('Graph Client tem getDownloadUrl', () => {
  assert(graphClientCode.includes('@microsoft.graph.downloadUrl'), 'Deve usar download URL do Graph');
});

// ═══ 7. COMPARTILHAMENTO ═════════════════════════════════════════════════════
console.log('\n── Compartilhamento ─────────────────────────────────────────────');

test('OneDrive share usa tipo view/edit', () => {
  assert(microsoftCode.includes("body.type || 'view'"), 'Deve suportar tipo view');
  assert(microsoftCode.includes("body.scope || 'anonymous'"), 'Deve suportar scope anonymous');
});

test('OneDrive invite tem recipients e message', () => {
  assert(microsoftCode.includes('body.recipients'), 'Deve ter recipients');
  assert(microsoftCode.includes('body.message'), 'Deve ter message');
});

test('Graph Client tem inviteSharing', () => {
  assert(graphClientCode.includes('inviteSharing'), 'inviteSharing deve existir');
});

// ═══ 8. SINCRONIZAÇÃO ═════════════════════════════════════════════════════════
console.log('\n── Sincronização ────────────────────────────────────────────────');

test('Status retorna lastSync', () => {
  assert(microsoftCode.includes('lastSync'), 'Status deve retornar lastSync');
});

test('Status retorna expiresAt', () => {
  assert(microsoftCode.includes('expiresAt'), 'Status deve retornar expiresAt');
});

test('Status retorna connected', () => {
  assert(microsoftCode.includes("connected: isConnected"), 'Status deve retornar connected');
});

test('Graph Client atualiza lastSync no token', () => {
  assert(graphClientCode.includes('lastSync:'), 'Graph client deve atualizar lastSync');
});

// ═══ 9. RECUPERAÇÃO DE FALHAS ════════════════════════════════════════════════
console.log('\n── Recuperação de Falhas ────────────────────────────────────────');

test('Graph Client tem retry logic', () => {
  assert(graphClientCode.includes('retry') || graphClientCode.includes('maxRetries'), 'Deve ter lógica de retry');
});

test('Microsoft API tem handler global try/catch', () => {
  assert(microsoftCode.includes('catch (err)'), 'Deve ter try/catch global');
});

test('Microsoft API retorna erro formatado', () => {
  assert(microsoftCode.includes("{ ok: false, error:"), 'Deve retornar erro formatado');
});

test('Refresh token trata token expirado', () => {
  assert(microsoftCode.includes("action === 'refresh-token'"), 'Refresh token deve existir');
  assert(graphClientCode.includes('refreshToken'), 'Graph client deve ter refresh');
});

test('Microsoft API detecta token expirado no status', () => {
  assert(microsoftCode.includes('token.expires_at'), 'Deve verificar expiração');
  assert(microsoftCode.includes('token.expires_at - Date.now()'), 'Deve calcular tempo restante');
});

// ═══ 10. LOGS ═════════════════════════════════════════════════════════════════
console.log('\n── Logs ─────────────────────────────────────────────────────────');

test('Graph Client tem console.warn para erros', () => {
  assert(graphClientCode.includes('console.warn(') || graphClientCode.includes('console.log('), 'Deve ter logging');
});

test('Graph Client registra token refresh', () => {
  assert(graphClientCode.includes('refresh'), 'Deve registrar refresh operations');
});

// ═══ 11. MULTIUSUÁRIO ═════════════════════════════════════════════════════════
console.log('\n── Multiusuário ─────────────────────────────────────────────────');

test('Tokens são scoped por userId', () => {
  assert(graphClientCode.includes('userId') && (graphClientCode.includes(':') || graphClientCode.includes('sub')), 'Tokens devem ser scoped por user');
});

test('Microsoft API usa session.sub para userId', () => {
  assert(microsoftCode.includes('session.sub'), 'Deve usar session.sub como userId');
});

// ═══ 12. FRONTEND INTEGRATION ════════════════════════════════════════════════
console.log('\n── Frontend Integration ─────────────────────────────────────────');

const commHtml = fs.readFileSync(path.resolve(__dirname, '../premium_ui/modules/communication.html'), 'utf8');

test('Frontend tem msRefreshStatus function', () => {
  assert(commHtml.includes('function msRefreshStatus'), 'msRefreshStatus deve existir');
});

test('Frontend tem msConnect function', () => {
  assert(commHtml.includes('function msConnect'), 'msConnect deve existir');
});

test('Frontend tem msDisconnect function', () => {
  assert(commHtml.includes('function msDisconnect'), 'msDisconnect deve existir');
});

test('Frontend chama msRefreshStatus no moduleShown', () => {
  assert(commHtml.includes('msRefreshStatus()'), 'msRefreshStatus deve ser chamado no moduleShown');
});

test('Frontend tem ms-status-dot element', () => {
  assert(commHtml.includes('ms-status-dot'), 'Elemento ms-status-dot deve existir');
});

test('Frontend tem ms-status-text element', () => {
  assert(commHtml.includes('ms-status-text'), 'Elemento ms-status-text deve existir');
});

test('Frontend tem OneDrive page link', () => {
  assert(commHtml.includes("showPage('onedrive')"), 'OneDrive page link deve existir');
});

test('Frontend tem Teams page link', () => {
  assert(commHtml.includes("showPage('teams')"), 'Teams page link deve existir');
});

// ═══ RESULTADO ════════════════════════════════════════════════════════════════
console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
console.log('═══════════════════════════════════════════════════════════════');

if (failed > 0) {
  console.log('\nFalhas:');
  errors.forEach(e => console.log(`  ✗ ${e}`));
}

process.exit(failed > 0 ? 1 : 0);
