// LifeOS Enterprise — Members Management API v1.0
// Cloudflare Pages Function: GET/POST/DELETE /api/enterprise/members
// Phase 135 — Enterprise User Management
import { getCookie, json, verifySession } from '../../_auth.js';

const VALID_ROLES = ['admin', 'manager', 'member', 'viewer'];

export async function onRequestGet({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId') || 'default';

  if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Serviço indisponível' });

  try {
    const wsRaw = await env.LIFEOS_KV.get(`workspace:${workspaceId}`);
    if (!wsRaw) {
      return json(200, { ok: true, members: [], workspace: null });
    }

    const ws = JSON.parse(wsRaw);

    // Verificar se o usuário tem acesso ao workspace
    const isMember = ws.members?.some(m => m.email === session.sub) || ws.ownerId === session.sub;
    if (!isMember) return json(403, { ok: false, error: 'Sem acesso a este workspace' });

    // Enriquecer dados dos membros com perfis do KV
    const enrichedMembers = await Promise.all(
      (ws.members || []).map(async (member) => {
        try {
          const userRaw = await env.LIFEOS_KV.get(`user:${member.email}`);
          if (userRaw) {
            const userData = JSON.parse(userRaw);
            return {
              ...member,
              name: userData.name,
              avatar: userData.avatar,
              plan: userData.plan,
              lastLoginAt: userData.lastLoginAt,
            };
          }
        } catch (_) { /* ignorar */ }
        return member;
      })
    );

    return json(200, {
      ok: true,
      workspace: {
        id: workspaceId,
        name: ws.name,
        ownerId: ws.ownerId,
        createdAt: ws.createdAt,
        plan: ws.plan,
      },
      members: enrichedMembers,
      total: enrichedMembers.length,
    });
  } catch (_) {
    return json(500, { ok: false, error: 'Erro ao carregar membros' });
  }
}

export async function onRequestPost({ request, env }) {
  const secret = env.LIFEOS_SESSION_SECRET;
  if (!secret) return json(503, { ok: false, error: 'Serviço indisponível' });

  const cookieHeader = request.headers.get('cookie');
  const token = getCookie(cookieHeader);
  const session = await verifySession(token, secret);
  if (!session) return json(401, { ok: false, error: 'Não autenticado' });

  let input = {};
  try { input = await request.json(); } catch { return json(400, { ok: false, error: 'Requisição inválida' }); }

  const action = String(input.action || '');
  const workspaceId = String(input.workspaceId || 'default');

  if (!env.LIFEOS_KV) return json(503, { ok: false, error: 'Serviço indisponível' });

  if (action === 'update_role') {
    const memberEmail = String(input.email || '').trim().toLowerCase();
    const newRole = String(input.role || '').toLowerCase();

    if (!memberEmail) return json(400, { ok: false, error: 'E-mail do membro obrigatório' });
    if (!VALID_ROLES.includes(newRole)) {
      return json(400, { ok: false, error: `Papel inválido. Use: ${VALID_ROLES.join(', ')}` });
    }

    try {
      const wsRaw = await env.LIFEOS_KV.get(`workspace:${workspaceId}`);
      if (!wsRaw) return json(404, { ok: false, error: 'Workspace não encontrado' });

      const ws = JSON.parse(wsRaw);

      // Verificar permissão (apenas admin ou owner podem alterar papéis)
      const requester = ws.members?.find(m => m.email === session.sub);
      if (ws.ownerId !== session.sub && requester?.role !== 'admin') {
        return json(403, { ok: false, error: 'Sem permissão para alterar papéis' });
      }

      // Não permitir alterar papel do owner
      if (memberEmail === ws.ownerId) {
        return json(400, { ok: false, error: 'Não é possível alterar o papel do proprietário' });
      }

      const memberIdx = ws.members?.findIndex(m => m.email === memberEmail);
      if (memberIdx === -1 || memberIdx === undefined) {
        return json(404, { ok: false, error: 'Membro não encontrado' });
      }

      ws.members[memberIdx].role = newRole;
      ws.members[memberIdx].updatedAt = new Date().toISOString();
      await env.LIFEOS_KV.put(`workspace:${workspaceId}`, JSON.stringify(ws));

      return json(200, { ok: true, message: `Papel de ${memberEmail} atualizado para ${newRole}` });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao atualizar papel' });
    }
  }

  if (action === 'remove') {
    const memberEmail = String(input.email || '').trim().toLowerCase();
    if (!memberEmail) return json(400, { ok: false, error: 'E-mail do membro obrigatório' });

    try {
      const wsRaw = await env.LIFEOS_KV.get(`workspace:${workspaceId}`);
      if (!wsRaw) return json(404, { ok: false, error: 'Workspace não encontrado' });

      const ws = JSON.parse(wsRaw);

      // Verificar permissão
      const requester = ws.members?.find(m => m.email === session.sub);
      const isSelf = memberEmail === session.sub;
      if (!isSelf && ws.ownerId !== session.sub && requester?.role !== 'admin') {
        return json(403, { ok: false, error: 'Sem permissão para remover membros' });
      }

      // Não permitir remover o owner
      if (memberEmail === ws.ownerId) {
        return json(400, { ok: false, error: 'Não é possível remover o proprietário do workspace' });
      }

      ws.members = (ws.members || []).filter(m => m.email !== memberEmail);
      await env.LIFEOS_KV.put(`workspace:${workspaceId}`, JSON.stringify(ws));

      return json(200, { ok: true, message: `${memberEmail} removido do workspace` });
    } catch (_) {
      return json(500, { ok: false, error: 'Erro ao remover membro' });
    }
  }

  return json(400, { ok: false, error: 'Ação inválida. Use: update_role, remove' });
}

export async function onRequest({ request, env }) {
  if (request.method === 'GET') return onRequestGet({ request, env });
  if (request.method === 'POST') return onRequestPost({ request, env });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' } });
  return json(405, { ok: false, error: 'Método não permitido' });
}
