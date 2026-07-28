// LifeOS Enterprise — Microsoft Ecosystem API
// Phase 751 — Microsoft Ecosystem Enterprise Integration
// REST endpoint: GET/POST /api/microsoft?action=<action>
// Covers: OAuth, Outlook Mail, Calendar, OneDrive, Teams
// Compatible with existing KV namespace: oauth:token:{userId}:microsoft_365
import { getCookie, json, verifySession } from '../_auth.js';
import {
  MAIL, CALENDAR, ONEDRIVE, TEAMS, CONNECTIONS,
  getAccessToken, refreshAccessToken, graphRequest, graphDownload,
} from './microsoft/graph-client.js';

const MS_REDIRECT_SCOPE = 'offline_access User.Read Mail.Read Mail.Send Mail.ReadWrite Calendars.Read Calendars.ReadWrite Files.Read.All Files.ReadWrite.All Sites.Read.All Channel.ReadBasic.All ChannelMessage.Read ChannelMessage.Send Chat.Read';

function getSession(request, env) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return { ok: false, error: 'Serviço indisponível' };
  const token = getCookie(request.headers.get('cookie'));
  const session = token ? verifySession(token, secret) : null;
  return session;
}

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const session = await getSession(request, env);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Storage indisponível' });

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'status';
  const origin = url.origin;

  try {
    // ─── Status / Profile ───────────────────────────────────────────────────
    if (action === 'status') {
      const tokenKey = `oauth:token:${session.sub}:microsoft_365`;
      const tokenRaw = await kv.get(tokenKey);
      const token = tokenRaw ? JSON.parse(tokenRaw) : null;
      const isConnected = !!token?.access_token;
      const isExpired = token?.expires_at ? (token.expires_at - Date.now()) < 0 : false;

      let profile = null;
      if (isConnected && !isExpired) {
        const profileRes = await CONNECTIONS.getProfile(kv, session.sub, env);
        if (profileRes.ok) profile = profileRes.data;
      }

      return json(200, {
        ok: true,
        provider: 'microsoft_365',
        connected: isConnected,
        expired: isExpired,
        profile,
        scopes: token?.scope || '',
        connectedAt: token?.connectedAt || null,
        expiresAt: token?.expires_at ? new Date(token.expires_at).toISOString() : null,
        lastSync: token?.lastSync || null,
        configured: !!(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
      });
    }

    // ─── Profile ────────────────────────────────────────────────────────────
    if (action === 'profile') {
      const result = await CONNECTIONS.getProfile(kv, session.sub, env);
      return json(result.ok ? 200 : 400, result);
    }

    // ─── Test Connection ────────────────────────────────────────────────────
    if (action === 'test') {
      const result = await CONNECTIONS.testConnection(kv, session.sub, env);
      return json(result.ok ? 200 : 400, result);
    }

    // ─── OAuth URL ──────────────────────────────────────────────────────────
    if (action === 'oauth-url') {
      if (!env.MICROSOFT_CLIENT_ID) return json(400, { ok: false, error: 'MICROSOFT_CLIENT_ID não configurado', setupRequired: true });
      const redirectUri = `${origin}/api/oauth/callback/microsoft_365`;
      const state = btoa(JSON.stringify({ userId: session.sub, integrationId: 'microsoft_365', ts: Date.now() }));
      await kv.put(`oauth:state:${state}`, JSON.stringify({ userId: session.sub, integrationId: 'microsoft_365', redirectUri }), { expirationTtl: 600 });
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(env.MICROSOFT_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(MS_REDIRECT_SCOPE)}&state=${encodeURIComponent(state)}&response_mode=query`;
      return json(200, { ok: true, authUrl });
    }

    // ─── MAIL: List Messages ────────────────────────────────────────────────
    if (action === 'mail-list') {
      const folderId = url.searchParams.get('folderId') || 'inbox';
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const expandAttachments = url.searchParams.get('expand') === 'attachments';
      const result = await MAIL.listMessages(kv, session.sub, env, folderId, { limit, offset, expandAttachments });
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, messages: result.data.value || [], provider: 'outlook', folder: folderId });
    }

    // ─── MAIL: Get Message ──────────────────────────────────────────────────
    if (action === 'mail-get') {
      const messageId = url.searchParams.get('messageId');
      if (!messageId) return json(400, { ok: false, error: 'messageId obrigatório' });
      const result = await MAIL.getMessage(kv, session.sub, env, messageId);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, message: result.data, provider: 'outlook' });
    }

    // ─── MAIL: List Folders ─────────────────────────────────────────────────
    if (action === 'mail-folders') {
      const result = await MAIL.listFolders(kv, session.sub, env);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, folders: result.data.value || [], provider: 'outlook' });
    }

    // ─── MAIL: Get Attachments ──────────────────────────────────────────────
    if (action === 'mail-attachments') {
      const messageId = url.searchParams.get('messageId');
      if (!messageId) return json(400, { ok: false, error: 'messageId obrigatório' });
      const result = await MAIL.getAttachments(kv, session.sub, env, messageId);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, attachments: result.data.value || [], provider: 'outlook' });
    }

    // ─── MAIL: Search ───────────────────────────────────────────────────────
    if (action === 'mail-search') {
      const q = url.searchParams.get('q');
      if (!q) return json(400, { ok: false, error: 'query obrigatória' });
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const result = await MAIL.searchMessages(kv, session.sub, env, q, { limit });
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, messages: result.data.value || [], query: q, provider: 'outlook' });
    }

    // ─── CALENDAR: List Events ──────────────────────────────────────────────
    if (action === 'calendar-view') {
      const start = url.searchParams.get('start') || new Date().toISOString();
      const end = url.searchParams.get('end') || new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const result = await CALENDAR.getCalendarView(kv, session.sub, env, start, end, { limit });
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, events: result.data.value || [], provider: 'outlook' });
    }

    // ─── CALENDAR: List Calendars ───────────────────────────────────────────
    if (action === 'calendar-list') {
      const result = await CALENDAR.listCalendars(kv, session.sub, env);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, calendars: result.data.value || [], provider: 'outlook' });
    }

    // ─── CALENDAR: Get Event ────────────────────────────────────────────────
    if (action === 'calendar-get') {
      const eventId = url.searchParams.get('eventId');
      if (!eventId) return json(400, { ok: false, error: 'eventId obrigatório' });
      const result = await CALENDAR.getEvent(kv, session.sub, env, eventId);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, event: result.data, provider: 'outlook' });
    }

    // ─── ONEDRIVE: Root ─────────────────────────────────────────────────────
    if (action === 'onedrive-root') {
      const result = await ONEDRIVE.getRoot(kv, session.sub, env);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, root: result.data, provider: 'onedrive' });
    }

    // ─── ONEDRIVE: List Items ───────────────────────────────────────────────
    if (action === 'onedrive-list') {
      const itemId = url.searchParams.get('itemId');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const result = await ONEDRIVE.listItems(kv, session.sub, env, itemId, { limit });
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, items: result.data.value || [], provider: 'onedrive' });
    }

    // ─── ONEDRIVE: Get Item ─────────────────────────────────────────────────
    if (action === 'onedrive-get') {
      const itemId = url.searchParams.get('itemId');
      if (!itemId) return json(400, { ok: false, error: 'itemId obrigatório' });
      const result = await ONEDRIVE.getItem(kv, session.sub, env, itemId);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, item: result.data, provider: 'onedrive' });
    }

    // ─── ONEDRIVE: Recent ───────────────────────────────────────────────────
    if (action === 'onedrive-recent') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const result = await ONEDRIVE.getRecent(kv, session.sub, env, { limit });
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, items: result.data.value || [], provider: 'onedrive' });
    }

    // ─── ONEDRIVE: Search ───────────────────────────────────────────────────
    if (action === 'onedrive-search') {
      const q = url.searchParams.get('q');
      if (!q) return json(400, { ok: false, error: 'query obrigatória' });
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const result = await ONEDRIVE.searchItems(kv, session.sub, env, q, { limit });
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, items: result.data.value || [], query: q, provider: 'onedrive' });
    }

    // ─── ONEDRIVE: Permissions ──────────────────────────────────────────────
    if (action === 'onedrive-permissions') {
      const itemId = url.searchParams.get('itemId');
      if (!itemId) return json(400, { ok: false, error: 'itemId obrigatório' });
      const result = await ONEDRIVE.getPermissions(kv, session.sub, env, itemId);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, permissions: result.data.value || [], provider: 'onedrive' });
    }

    // ─── TEAMS: List Teams ──────────────────────────────────────────────────
    if (action === 'teams-list') {
      const result = await TEAMS.listTeams(kv, session.sub, env);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, teams: result.data.value || [], provider: 'teams' });
    }

    // ─── TEAMS: List Channels ───────────────────────────────────────────────
    if (action === 'teams-channels') {
      const teamId = url.searchParams.get('teamId');
      if (!teamId) return json(400, { ok: false, error: 'teamId obrigatório' });
      const result = await TEAMS.listChannels(kv, session.sub, env, teamId);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, channels: result.data.value || [], provider: 'teams' });
    }

    // ─── TEAMS: List Messages ───────────────────────────────────────────────
    if (action === 'teams-messages') {
      const teamId = url.searchParams.get('teamId');
      const channelId = url.searchParams.get('channelId');
      if (!teamId || !channelId) return json(400, { ok: false, error: 'teamId e channelId obrigatórios' });
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const result = await TEAMS.listChannelMessages(kv, session.sub, env, teamId, channelId, { limit });
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, messages: result.data.value || [], provider: 'teams' });
    }

    // ─── TEAMS: Team Files ──────────────────────────────────────────────────
    if (action === 'teams-files') {
      const teamId = url.searchParams.get('teamId');
      if (!teamId) return json(400, { ok: false, error: 'teamId obrigatório' });
      const result = await TEAMS.listTeamFiles(kv, session.sub, env, teamId);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, files: result.data.value || [], provider: 'teams' });
    }

    // ─── TEAMS: Tabs ────────────────────────────────────────────────────────
    if (action === 'teams-tabs') {
      const teamId = url.searchParams.get('teamId');
      const channelId = url.searchParams.get('channelId');
      if (!teamId || !channelId) return json(400, { ok: false, error: 'teamId e channelId obrigatórios' });
      const result = await TEAMS.listTabs(kv, session.sub, env, teamId, channelId);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, tabs: result.data.value || [], provider: 'teams' });
    }

    return json(400, { ok: false, error: `Ação GET desconhecida: ${action}` });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro interno: ' + err.message });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const session = await getSession(request, env);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const kv = env.LIFEOS_KV;
  if (!kv) return json(503, { ok: false, error: 'Storage indisponível' });

  let body = {};
  try { body = await request.json(); } catch { /* empty body */ }
  const action = body.action || body._action || 'unknown';

  try {
    // ─── OAUTH: Refresh Token ───────────────────────────────────────────────
    if (action === 'refresh-token') {
      const tokenKey = `oauth:token:${session.sub}:microsoft_365`;
      const tokenRaw = await kv.get(tokenKey);
      if (!tokenRaw) return json(400, { ok: false, error: 'Token não encontrado' });
      const token = JSON.parse(tokenRaw);
      if (!token.refresh_token) return json(400, { ok: false, error: 'Refresh token não disponível' });
      const result = await refreshAccessToken(kv, session.sub, token.refresh_token, env);
      return json(result.ok ? 200 : 400, result);
    }

    // ─── OAUTH: Disconnect ──────────────────────────────────────────────────
    if (action === 'disconnect') {
      const result = await CONNECTIONS.revokeConnection(kv, session.sub, env);
      return json(200, result);
    }

    // ─── OAUTH: Reconnect (re-authorize) ────────────────────────────────────
    if (action === 'reconnect') {
      const origin = new URL(request.url).origin;
      const redirectUri = `${origin}/api/oauth/callback/microsoft_365`;
      const state = btoa(JSON.stringify({ userId: session.sub, integrationId: 'microsoft_365', ts: Date.now() }));
      await kv.put(`oauth:state:${state}`, JSON.stringify({ userId: session.sub, integrationId: 'microsoft_365', redirectUri, reconnect: true }), { expirationTtl: 600 });
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${encodeURIComponent(env.MICROSOFT_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(MS_REDIRECT_SCOPE)}&state=${encodeURIComponent(state)}&prompt=select_account`;
      return json(200, { ok: true, authUrl });
    }

    // ─── MAIL: Send Message ─────────────────────────────────────────────────
    if (action === 'mail-send') {
      if (!body.to) return json(400, { ok: false, error: 'destinatário obrigatório' });
      const result = await MAIL.sendMessage(kv, session.sub, env, {
        to: body.to,
        subject: body.subject,
        body: body.body,
        isHtml: body.isHtml !== false,
        cc: body.cc,
        bcc: body.bcc,
        importance: body.importance,
        attachments: body.attachments,
      });
      if (!result.ok) return json(400, result);
      return json(202, { ok: true, message: 'Email enviado com sucesso', provider: 'outlook' });
    }

    // ─── MAIL: Send Draft ───────────────────────────────────────────────────
    if (action === 'mail-send-draft') {
      if (!body.draftId) return json(400, { ok: false, error: 'draftId obrigatório' });
      const result = await MAIL.sendDraft(kv, session.sub, env, body.draftId);
      if (!result.ok) return json(400, result);
      return json(202, { ok: true, message: 'Rascunho enviado', provider: 'outlook' });
    }

    // ─── MAIL: Create Draft ─────────────────────────────────────────────────
    if (action === 'mail-create-draft') {
      if (!body.to) return json(400, { ok: false, error: 'destinatário obrigatório' });
      const result = await MAIL.createDraft(kv, session.sub, env, {
        to: body.to,
        subject: body.subject,
        body: body.body,
        isHtml: body.isHtml !== false,
      });
      if (!result.ok) return json(400, result);
      return json(201, { ok: true, draft: result.data, provider: 'outlook' });
    }

    // ─── MAIL: Reply ────────────────────────────────────────────────────────
    if (action === 'mail-reply') {
      if (!body.messageId) return json(400, { ok: false, error: 'messageId obrigatório' });
      const result = await MAIL.reply(kv, session.sub, env, body.messageId, {
        body: body.body,
        isHtml: body.isHtml !== false,
        comment: body.comment,
      });
      if (!result.ok) return json(400, result);
      return json(202, { ok: true, message: 'Resposta enviada', provider: 'outlook' });
    }

    // ─── MAIL: Reply All ────────────────────────────────────────────────────
    if (action === 'mail-reply-all') {
      if (!body.messageId) return json(400, { ok: false, error: 'messageId obrigatório' });
      const result = await MAIL.replyAll(kv, session.sub, env, body.messageId, {
        body: body.body,
        isHtml: body.isHtml !== false,
        comment: body.comment,
      });
      if (!result.ok) return json(400, result);
      return json(202, { ok: true, message: 'Resposta enviada a todos', provider: 'outlook' });
    }

    // ─── MAIL: Forward ──────────────────────────────────────────────────────
    if (action === 'mail-forward') {
      if (!body.messageId || !body.to) return json(400, { ok: false, error: 'messageId e destinatário obrigatórios' });
      const result = await MAIL.forward(kv, session.sub, env, body.messageId, {
        to: body.to,
        comment: body.comment,
      });
      if (!result.ok) return json(400, result);
      return json(202, { ok: true, message: 'Email encaminhado', provider: 'outlook' });
    }

    // ─── MAIL: Mark Read/Unread ─────────────────────────────────────────────
    if (action === 'mail-mark-read') {
      if (!body.messageId) return json(400, { ok: false, error: 'messageId obrigatório' });
      const result = await MAIL.markRead(kv, session.sub, env, body.messageId, true);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, message: 'Marcado como lido', provider: 'outlook' });
    }

    if (action === 'mail-mark-unread') {
      if (!body.messageId) return json(400, { ok: false, error: 'messageId obrigatório' });
      const result = await MAIL.markRead(kv, session.sub, env, body.messageId, false);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, message: 'Marcado como não lido', provider: 'outlook' });
    }

    // ─── MAIL: Move to Folder ───────────────────────────────────────────────
    if (action === 'mail-move') {
      if (!body.messageId || !body.destinationId) return json(400, { ok: false, error: 'messageId e destinationId obrigatórios' });
      const result = await MAIL.moveTo(kv, session.sub, env, body.messageId, body.destinationId);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, message: 'Movido', destination: body.destinationId, provider: 'outlook' });
    }

    // ─── MAIL: Delete ───────────────────────────────────────────────────────
    if (action === 'mail-delete') {
      if (!body.messageId) return json(400, { ok: false, error: 'messageId obrigatório' });
      const result = await MAIL.deleteMessage(kv, session.sub, env, body.messageId);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, message: 'Deletado permanentemente', provider: 'outlook' });
    }

    // ─── MAIL: Move to Trash ────────────────────────────────────────────────
    if (action === 'mail-trash') {
      if (!body.messageId) return json(400, { ok: false, error: 'messageId obrigatório' });
      const result = await MAIL.moveTo(kv, session.sub, env, body.messageId, 'deleteditems');
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, message: 'Movido para lixeira', provider: 'outlook' });
    }

    // ─── MAIL: Restore from Trash ───────────────────────────────────────────
    if (action === 'mail-restore') {
      if (!body.messageId) return json(400, { ok: false, error: 'messageId obrigatório' });
      const result = await MAIL.moveTo(kv, session.sub, env, body.messageId, 'inbox');
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, message: 'Restaurado para inbox', provider: 'outlook' });
    }

    // ─── CALENDAR: Create Event ─────────────────────────────────────────────
    if (action === 'calendar-create') {
      if (!body.title && !body.subject) return json(400, { ok: false, error: 'título obrigatório' });
      if (!body.date) return json(400, { ok: false, error: 'data obrigatória' });
      const result = await CALENDAR.createEvent(kv, session.sub, env, {
        subject: body.subject || body.title,
        title: body.title,
        body: body.body ? { contentType: 'HTML', content: body.body } : undefined,
        description: body.description,
        date: body.date,
        time: body.time,
        endTime: body.endTime,
        start: body.start,
        end: body.end,
        location: body.location,
        isAllDay: body.allDay || body.isAllDay,
        attendees: body.attendees,
        reminder: body.reminder,
        showAs: body.showAs,
        calendarId: body.calendarId,
      });
      if (!result.ok) return json(400, result);
      return json(201, { ok: true, event: result.data, provider: 'outlook' });
    }

    // ─── CALENDAR: Update Event ─────────────────────────────────────────────
    if (action === 'calendar-update') {
      if (!body.eventId) return json(400, { ok: false, error: 'eventId obrigatório' });
      const result = await CALENDAR.updateEvent(kv, session.sub, env, body.eventId, body);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, event: result.data, provider: 'outlook' });
    }

    // ─── CALENDAR: Delete Event ─────────────────────────────────────────────
    if (action === 'calendar-delete') {
      if (!body.eventId) return json(400, { ok: false, error: 'eventId obrigatório' });
      const result = await CALENDAR.deleteEvent(kv, session.sub, env, body.eventId);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, message: 'Evento deletado', provider: 'outlook' });
    }

    // ─── CALENDAR: Accept Event ─────────────────────────────────────────────
    if (action === 'calendar-accept') {
      if (!body.eventId) return json(400, { ok: false, error: 'eventId obrigatório' });
      const result = await CALENDAR.acceptEvent(kv, session.sub, env, body.eventId, {
        comment: body.comment,
        sendResponse: body.sendResponse !== false,
        proposedNewTime: body.proposedNewTime,
      });
      if (!result.ok) return json(400, result);
      return json(202, { ok: true, message: 'Convite aceito', provider: 'outlook' });
    }

    // ─── CALENDAR: Decline Event ────────────────────────────────────────────
    if (action === 'calendar-decline') {
      if (!body.eventId) return json(400, { ok: false, error: 'eventId obrigatório' });
      const result = await CALENDAR.declineEvent(kv, session.sub, env, body.eventId, {
        comment: body.comment,
        sendResponse: body.sendResponse !== false,
      });
      if (!result.ok) return json(400, result);
      return json(202, { ok: true, message: 'Convite recusado', provider: 'outlook' });
    }

    // ─── CALENDAR: Tentative Accept ─────────────────────────────────────────
    if (action === 'calendar-tentative') {
      if (!body.eventId) return json(400, { ok: false, error: 'eventId obrigatório' });
      const result = await CALENDAR.tentativelyAcceptEvent(kv, session.sub, env, body.eventId, {
        comment: body.comment,
        sendResponse: body.sendResponse !== false,
        proposedNewTime: body.proposedNewTime,
      });
      if (!result.ok) return json(400, result);
      return json(202, { ok: true, message: 'Convite aceito provisoriamente', provider: 'outlook' });
    }

    // ─── CALENDAR: Propose New Time ─────────────────────────────────────────
    if (action === 'calendar-propose-time') {
      if (!body.eventId || !body.newStart || !body.newEnd) return json(400, { ok: false, error: 'eventId, newStart e newEnd obrigatórios' });
      const result = await CALENDAR.proposeNewTime(kv, session.sub, env, body.eventId, body.newStart, body.newEnd, {
        comment: body.comment,
        informationAction: body.informationAction,
      });
      if (!result.ok) return json(400, result);
      return json(202, { ok: true, message: 'Novo horário proposto', provider: 'outlook' });
    }

    // ─── CALENDAR: Create Calendar ──────────────────────────────────────────
    if (action === 'calendar-create-cal') {
      if (!body.name) return json(400, { ok: false, error: 'nome do calendário obrigatório' });
      const result = await CALENDAR.createCalendar(kv, session.sub, env, body.name, body.color);
      if (!result.ok) return json(400, result);
      return json(201, { ok: true, calendar: result.data, provider: 'outlook' });
    }

    // ─── ONEDRIVE: Create Folder ────────────────────────────────────────────
    if (action === 'onedrive-create-folder') {
      if (!body.name) return json(400, { ok: false, error: 'nome obrigatório' });
      const result = await ONEDRIVE.createFolder(kv, session.sub, env, body.parentItemId, body.name);
      if (!result.ok) return json(400, result);
      return json(201, { ok: true, folder: result.data, provider: 'onedrive' });
    }

    // ─── ONEDRIVE: Upload File ──────────────────────────────────────────────
    if (action === 'onedrive-upload') {
      if (!body.fileName || !body.content) return json(400, { ok: false, error: 'fileName e content obrigatórios' });
      const content = Uint8Array.from(atob(body.content), c => c.charCodeAt(0));
      const result = await ONEDRIVE.uploadFile(kv, session.sub, env, body.parentItemId, body.fileName, content, body.contentType);
      if (!result.ok) return json(400, result);
      return json(201, { ok: true, file: result.data, provider: 'onedrive' });
    }

    // ─── ONEDRIVE: Delete Item ──────────────────────────────────────────────
    if (action === 'onedrive-delete') {
      if (!body.itemId) return json(400, { ok: false, error: 'itemId obrigatório' });
      const result = await ONEDRIVE.deleteItem(kv, session.sub, env, body.itemId);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, message: 'Item deletado', provider: 'onedrive' });
    }

    // ─── ONEDRIVE: Rename Item ──────────────────────────────────────────────
    if (action === 'onedrive-rename') {
      if (!body.itemId || !body.newName) return json(400, { ok: false, error: 'itemId e newName obrigatórios' });
      const result = await ONEDRIVE.renameItem(kv, session.sub, env, body.itemId, body.newName);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, item: result.data, provider: 'onedrive' });
    }

    // ─── ONEDRIVE: Move Item ────────────────────────────────────────────────
    if (action === 'onedrive-move') {
      if (!body.itemId || !body.targetParentId) return json(400, { ok: false, error: 'itemId e targetParentId obrigatórios' });
      const result = await ONEDRIVE.moveItem(kv, session.sub, env, body.itemId, body.targetParentId);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, item: result.data, provider: 'onedrive' });
    }

    // ─── ONEDRIVE: Share Item ───────────────────────────────────────────────
    if (action === 'onedrive-share') {
      if (!body.itemId) return json(400, { ok: false, error: 'itemId obrigatório' });
      const result = await ONEDRIVE.shareItem(kv, session.sub, env, body.itemId, body.type || 'view', body.scope || 'anonymous');
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, sharingLink: result.data, provider: 'onedrive' });
    }

    // ─── ONEDRIVE: Invite Sharing ───────────────────────────────────────────
    if (action === 'onedrive-invite') {
      if (!body.itemId || !body.recipients) return json(400, { ok: false, error: 'itemId e recipients obrigatórios' });
      const result = await ONEDRIVE.inviteSharing(kv, session.sub, env, body.itemId, body.recipients, body.message, body.requireSignIn);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, invitations: result.data.value || [], provider: 'onedrive' });
    }

    // ─── TEAMS: Send Message ────────────────────────────────────────────────
    if (action === 'teams-send') {
      if (!body.teamId || !body.channelId) return json(400, { ok: false, error: 'teamId e channelId obrigatórios' });
      const result = await TEAMS.sendMessage(kv, session.sub, env, body.teamId, body.channelId, {
        content: body.content || body.body,
        isHtml: body.isHtml !== false,
        subject: body.subject,
      });
      if (!result.ok) return json(400, result);
      return json(201, { ok: true, message: 'Mensagem enviada', provider: 'teams' });
    }

    // ─── TEAMS: Reply Message ───────────────────────────────────────────────
    if (action === 'teams-reply') {
      if (!body.teamId || !body.channelId || !body.messageId) return json(400, { ok: false, error: 'teamId, channelId e messageId obrigatórios' });
      const result = await TEAMS.replyMessage(kv, session.sub, env, body.teamId, body.channelId, body.messageId, {
        content: body.content || body.body,
        isHtml: body.isHtml !== false,
      });
      if (!result.ok) return json(400, result);
      return json(201, { ok: true, message: 'Resposta enviada', provider: 'teams' });
    }

    // ─── TEAMS: Delete Message ──────────────────────────────────────────────
    if (action === 'teams-delete-message') {
      if (!body.teamId || !body.channelId || !body.messageId) return json(400, { ok: false, error: 'teamId, channelId e messageId obrigatórios' });
      const result = await TEAMS.deleteMessage(kv, session.sub, env, body.teamId, body.channelId, body.messageId);
      if (!result.ok) return json(400, result);
      return json(200, { ok: true, message: 'Mensagem deletada', provider: 'teams' });
    }

    return json(400, { ok: false, error: `Ação POST desconhecida: ${action}` });
  } catch (err) {
    return json(500, { ok: false, error: 'Erro interno: ' + err.message });
  }
}

// ─── Main Router ──────────────────────────────────────────────────────────────
export async function onRequest({ request, env }) {
  const method = request.method.toUpperCase();
  if (method === 'GET') return onRequestGet({ request, env });
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') return onRequestPost({ request, env });
  if (method === 'DELETE') return onRequestPost({ request, env });
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
  return new Response(JSON.stringify({ ok: false, error: 'Método não permitido' }), { status: 405, headers: { 'content-type': 'application/json' } });
}
