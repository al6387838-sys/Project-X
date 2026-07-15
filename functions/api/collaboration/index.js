// LifeOS Enterprise — Collaboration API v1.0
// Cloudflare Pages Function: GET/POST /api/collaboration
// Phase 148 — Enterprise Collaboration
// Comentários, menções, equipes, permissões granulares, atividade em tempo real
import { getCookie, json, verifySession, hasPermission } from '../../_auth.js';

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Tipos de permissão granulares ───
const PERMISSION_LEVELS = {
  owner: 'owner',
  admin: 'admin',
  editor: 'editor',
  commenter: 'commenter',
  viewer: 'viewer',
};

const PERMISSION_HIERARCHY = ['owner', 'admin', 'editor', 'commenter', 'viewer'];

function hasPermissionLevel(userLevel, requiredLevel) {
  const userIdx = PERMISSION_HIERARCHY.indexOf(userLevel);
  const reqIdx = PERMISSION_HIERARCHY.indexOf(requiredLevel);
  return userIdx <= reqIdx;
}

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const url = new URL(request.url);
  const view = url.searchParams.get('view') || 'teams';
  const kv = env.LIFEOS_KV;

  if (!kv) return json(200, { ok: true, data: {}, source: 'unavailable' });

  try {
    switch (view) {
      case 'teams': {
        const raw = await kv.get(`collab:teams:${session.sub}`);
        const teams = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, teams });
      }

      case 'team-members': {
        const teamId = url.searchParams.get('teamId');
        if (!teamId) return json(400, { ok: false, error: 'teamId obrigatório' });
        const raw = await kv.get(`collab:team-members:${teamId}`);
        const members = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, members });
      }

      case 'comments': {
        const resourceType = url.searchParams.get('resourceType'); // task, document, goal, etc
        const resourceId = url.searchParams.get('resourceId');
        if (!resourceType || !resourceId) return json(400, { ok: false, error: 'resourceType e resourceId obrigatórios' });
        const raw = await kv.get(`collab:comments:${resourceType}:${resourceId}`);
        const comments = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, comments });
      }

      case 'activity': {
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const teamId = url.searchParams.get('teamId');
        const key = teamId ? `collab:activity:${teamId}` : `collab:activity:${session.sub}`;
        const raw = await kv.get(key);
        const activity = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, activity: activity.slice(0, limit) });
      }

      case 'mentions': {
        const raw = await kv.get(`collab:mentions:${session.sub}`);
        const mentions = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, mentions });
      }

      case 'permissions': {
        const resourceType = url.searchParams.get('resourceType');
        const resourceId = url.searchParams.get('resourceId');
        if (!resourceType || !resourceId) return json(400, { ok: false, error: 'resourceType e resourceId obrigatórios' });
        const raw = await kv.get(`collab:permissions:${resourceType}:${resourceId}`);
        const permissions = raw ? JSON.parse(raw) : [];
        return json(200, { ok: true, permissions });
      }

      default:
        return json(400, { ok: false, error: 'view inválido' });
    }
  } catch (err) {
    return json(500, { ok: false, error: 'Erro ao carregar dados de colaboração' });
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

  // ─── Criar equipe ───
  if (action === 'create-team') {
    const { name, description, icon } = body;
    if (!name) return json(400, { ok: false, error: 'Nome obrigatório' });

    const team = {
      id: generateId(),
      name,
      description: description || '',
      icon: icon || '👥',
      owner: session.sub,
      createdAt: new Date().toISOString(),
      members: [{ userId: session.sub, role: 'owner', joinedAt: new Date().toISOString() }],
    };

    const raw = await kv.get(`collab:teams:${session.sub}`);
    const teams = raw ? JSON.parse(raw) : [];
    teams.unshift(team);
    await kv.put(`collab:teams:${session.sub}`, JSON.stringify(teams));

    // Registrar membros
    await kv.put(`collab:team-members:${team.id}`, JSON.stringify(team.members));

    // Registrar atividade
    await logActivity(kv, session.sub, team.id, {
      type: 'team-created',
      teamId: team.id,
      teamName: name,
      userId: session.sub,
    });

    return json(201, { ok: true, team });
  }

  // ─── Convidar membro para equipe ───
  if (action === 'invite-team-member') {
    const { teamId, memberEmail, role = 'editor' } = body;
    if (!teamId || !memberEmail) return json(400, { ok: false, error: 'teamId e memberEmail obrigatórios' });
    if (!PERMISSION_LEVELS[role]) return json(400, { ok: false, error: 'role inválido' });

    const raw = await kv.get(`collab:team-members:${teamId}`);
    const members = raw ? JSON.parse(raw) : [];

    if (members.some(m => m.email === memberEmail)) {
      return json(400, { ok: false, error: 'Membro já existe na equipe' });
    }

    const newMember = {
      userId: generateId(), // será substituído quando o usuário aceitar
      email: memberEmail,
      role,
      status: 'invited',
      invitedAt: new Date().toISOString(),
      invitedBy: session.sub,
    };

    members.push(newMember);
    await kv.put(`collab:team-members:${teamId}`, JSON.stringify(members));

    // Registrar convite
    const inviteRaw = await kv.get(`collab:invites:${memberEmail}`);
    const invites = inviteRaw ? JSON.parse(inviteRaw) : [];
    invites.push({
      id: generateId(),
      teamId,
      invitedBy: session.sub,
      role,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    await kv.put(`collab:invites:${memberEmail}`, JSON.stringify(invites));

    await logActivity(kv, session.sub, teamId, {
      type: 'member-invited',
      memberEmail,
      role,
    });

    return json(201, { ok: true, member: newMember });
  }

  // ─── Adicionar comentário ───
  if (action === 'add-comment') {
    const { resourceType, resourceId, text, mentions = [] } = body;
    if (!resourceType || !resourceId || !text) {
      return json(400, { ok: false, error: 'resourceType, resourceId e text obrigatórios' });
    }

    const comment = {
      id: generateId(),
      resourceType,
      resourceId,
      authorId: session.sub,
      authorEmail: session.email || session.sub,
      text,
      mentions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reactions: {},
    };

    const raw = await kv.get(`collab:comments:${resourceType}:${resourceId}`);
    const comments = raw ? JSON.parse(raw) : [];
    comments.push(comment);
    await kv.put(`collab:comments:${resourceType}:${resourceId}`, JSON.stringify(comments.slice(-500)));

    // Registrar menções
    for (const mention of mentions) {
      const mentionRaw = await kv.get(`collab:mentions:${mention}`);
      const mentionList = mentionRaw ? JSON.parse(mentionRaw) : [];
      mentionList.unshift({
        id: generateId(),
        commentId: comment.id,
        resourceType,
        resourceId,
        mentionedBy: session.sub,
        mentionedAt: new Date().toISOString(),
        read: false,
      });
      await kv.put(`collab:mentions:${mention}`, JSON.stringify(mentionList.slice(0, 100)));
    }

    return json(201, { ok: true, comment });
  }

  // ─── Editar comentário ───
  if (action === 'edit-comment') {
    const { resourceType, resourceId, commentId, text } = body;
    if (!resourceType || !resourceId || !commentId || !text) {
      return json(400, { ok: false, error: 'Parâmetros obrigatórios' });
    }

    const raw = await kv.get(`collab:comments:${resourceType}:${resourceId}`);
    const comments = raw ? JSON.parse(raw) : [];
    const idx = comments.findIndex(c => c.id === commentId);
    if (idx === -1) return json(404, { ok: false, error: 'Comentário não encontrado' });
    if (comments[idx].authorId !== session.sub) {
      return json(403, { ok: false, error: 'Sem permissão para editar' });
    }

    comments[idx].text = text;
    comments[idx].updatedAt = new Date().toISOString();
    comments[idx].edited = true;
    await kv.put(`collab:comments:${resourceType}:${resourceId}`, JSON.stringify(comments));

    return json(200, { ok: true, comment: comments[idx] });
  }

  // ─── Deletar comentário ───
  if (action === 'delete-comment') {
    const { resourceType, resourceId, commentId } = body;
    if (!resourceType || !resourceId || !commentId) {
      return json(400, { ok: false, error: 'Parâmetros obrigatórios' });
    }

    const raw = await kv.get(`collab:comments:${resourceType}:${resourceId}`);
    const comments = raw ? JSON.parse(raw) : [];
    const idx = comments.findIndex(c => c.id === commentId);
    if (idx === -1) return json(404, { ok: false, error: 'Comentário não encontrado' });
    if (comments[idx].authorId !== session.sub && !hasPermission(session, 'admin')) {
      return json(403, { ok: false, error: 'Sem permissão para deletar' });
    }

    comments.splice(idx, 1);
    await kv.put(`collab:comments:${resourceType}:${resourceId}`, JSON.stringify(comments));

    return json(200, { ok: true, deleted: commentId });
  }

  // ─── Adicionar reação a comentário ───
  if (action === 'add-reaction') {
    const { resourceType, resourceId, commentId, emoji } = body;
    if (!resourceType || !resourceId || !commentId || !emoji) {
      return json(400, { ok: false, error: 'Parâmetros obrigatórios' });
    }

    const raw = await kv.get(`collab:comments:${resourceType}:${resourceId}`);
    const comments = raw ? JSON.parse(raw) : [];
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return json(404, { ok: false, error: 'Comentário não encontrado' });

    if (!comment.reactions[emoji]) comment.reactions[emoji] = [];
    if (!comment.reactions[emoji].includes(session.sub)) {
      comment.reactions[emoji].push(session.sub);
    }

    await kv.put(`collab:comments:${resourceType}:${resourceId}`, JSON.stringify(comments));
    return json(200, { ok: true, reactions: comment.reactions });
  }

  // ─── Definir permissões de recurso ───
  if (action === 'set-permissions') {
    const { resourceType, resourceId, permissions } = body;
    if (!resourceType || !resourceId || !permissions) {
      return json(400, { ok: false, error: 'Parâmetros obrigatórios' });
    }

    const permData = {
      resourceType,
      resourceId,
      entries: permissions,
      updatedAt: new Date().toISOString(),
      updatedBy: session.sub,
    };

    await kv.put(`collab:permissions:${resourceType}:${resourceId}`, JSON.stringify(permData));

    await logActivity(kv, session.sub, null, {
      type: 'permissions-updated',
      resourceType,
      resourceId,
    });

    return json(200, { ok: true, permissions: permData });
  }

  // ─── Marcar menção como lida ───
  if (action === 'mark-mention-read') {
    const { mentionId } = body;
    if (!mentionId) return json(400, { ok: false, error: 'mentionId obrigatório' });

    const raw = await kv.get(`collab:mentions:${session.sub}`);
    const mentions = raw ? JSON.parse(raw) : [];
    const mention = mentions.find(m => m.id === mentionId);
    if (mention) {
      mention.read = true;
      mention.readAt = new Date().toISOString();
      await kv.put(`collab:mentions:${session.sub}`, JSON.stringify(mentions));
    }

    return json(200, { ok: true, read: true });
  }

  return json(400, { ok: false, error: 'Ação inválida' });
}

async function logActivity(kv, userId, teamId, entry) {
  try {
    const key = teamId ? `collab:activity:${teamId}` : `collab:activity:${userId}`;
    const raw = await kv.get(key);
    const activity = raw ? JSON.parse(raw) : [];
    activity.unshift({
      id: generateId(),
      userId,
      ...entry,
      timestamp: new Date().toISOString(),
    });
    await kv.put(key, JSON.stringify(activity.slice(0, 500)));
  } catch { /* ignorar */ }
}

export async function onRequest({ request, env }) {
  const ctx = { request, env };
  switch (request.method) {
    case 'GET': return onRequestGet(ctx);
    case 'POST': return onRequestPost(ctx);
    default: return json(405, { ok: false, error: 'Método não permitido' }, { allow: 'GET, POST' });
  }
}
