// LifeOS Enterprise — Microsoft Graph API Client
// Phase 751 — Microsoft Ecosystem Enterprise Integration
// Unified client for Outlook Mail, Calendar, OneDrive, Teams
// OAuth 2.0 with token refresh, retry, and error handling
// Compatible with existing KV namespace: oauth:token:{userId}:microsoft_365

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_BETA = 'https://graph.microsoft.com/beta';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// ─── Token Management ────────────────────────────────────────────────────────

/**
 * Retrieves the access token for a user, auto-refreshing if expired.
 * Uses the standard KV namespace: oauth:token:{userId}:microsoft_365
 */
async function getAccessToken(kv, userId, env) {
  const tokenKey = `oauth:token:${userId}:microsoft_365`;
  const tokenRaw = await kv.get(tokenKey);
  if (!tokenRaw) {
    return { ok: false, error: 'Microsoft não conectado', code: 'not_connected' };
  }

  const token = JSON.parse(tokenRaw);

  // Check if token is still valid (with 5-minute buffer)
  const expiresAt = token.expires_at || 0;
  const bufferMs = 5 * 60 * 1000;
  if (expiresAt > 0 && (expiresAt - Date.now()) > bufferMs) {
    return { ok: true, accessToken: token.access_token, token };
  }

  // Token expired — try refresh
  if (!token.refresh_token) {
    return { ok: false, error: 'Token expirado sem refresh token. Reconecte.', code: 'token_expired' };
  }

  const refreshResult = await refreshAccessToken(kv, userId, token.refresh_token, env);
  return refreshResult;
}

/**
 * Refreshes the access token using the refresh token.
 */
async function refreshAccessToken(kv, userId, refreshToken, env) {
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: env.MICROSOFT_CLIENT_ID || '',
      client_secret: env.MICROSOFT_CLIENT_SECRET || '',
      scope: 'offline_access User.Read Mail.Read Mail.Send Mail.ReadWrite Calendars.Read Calendars.ReadWrite Files.Read.All Files.ReadWrite.All Sites.Read.All Channel.ReadBasic.All ChannelMessage.Read Chat.Read User.Read.All'
    });

    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    });

    const data = await resp.json();

    if (!data.access_token) {
      return { ok: false, error: data.error_description || 'Falha ao renovar token', code: 'refresh_failed' };
    }

    const tokenKey = `oauth:token:${userId}:microsoft_365`;
    const existing = JSON.parse(await kv.get(tokenKey) || '{}');
    const updated = {
      ...existing,
      access_token: data.access_token,
      refresh_token: data.refresh_token || existing.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
      scope: data.scope || existing.scope,
      refreshedAt: new Date().toISOString(),
      lastSync: new Date().toISOString(),
    };
    await kv.put(tokenKey, JSON.stringify(updated));

    console.log('[MS-Graph] Token refresh successful for user ' + userId);
    return { ok: true, accessToken: data.access_token, token: updated };
  } catch (err) {
    console.warn('[MS-Graph] Token refresh failed: ' + err.message);
    return { ok: false, error: 'Erro ao renovar token: ' + err.message, code: 'refresh_error' };
  }
}

// ─── Graph API Client ─────────────────────────────────────────────────────────

/**
 * Makes an authenticated request to Microsoft Graph API with retry logic.
 */
async function graphRequest(kv, userId, env, method, path, options = {}) {
  const tokenResult = await getAccessToken(kv, userId, env);
  if (!tokenResult.ok) return { ok: false, error: tokenResult.error, code: tokenResult.code };

  const { accessToken } = tokenResult;
  let attempts = 0;
  let lastError = null;

  while (attempts < MAX_RETRIES) {
    attempts++;
    try {
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      const fetchOptions = { method, headers };
      if (options.body) fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      if (options.headers) Object.assign(headers, options.headers);

      const resp = await fetch(`${GRAPH_BASE}${path}`, fetchOptions);

      // 401 = token expired, try refresh once
      if (resp.status === 401 && attempts === 1) {
        const refreshResult = await refreshAccessToken(kv, userId, tokenResult.token.refresh_token, env);
        if (refreshResult.ok) {
          headers['Authorization'] = `Bearer ${refreshResult.accessToken}`;
          continue; // retry with new token
        }
        return { ok: false, error: 'Autenticação expirada. Reconecte o Microsoft.', code: 'auth_required' };
      }

      // 429 = rate limited
      if (resp.status === 429) {
        const retryAfter = resp.headers.get('Retry-After') || '1';
        await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000 + RETRY_DELAY));
        continue;
      }

      // 5xx = server error, retry
      if (resp.status >= 500 && attempts < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY * attempts));
        continue;
      }

      if (!resp.ok) {
        let errorBody = {};
        try { errorBody = await resp.json(); } catch {}
        return {
          ok: false,
          error: errorBody.error?.message || `HTTP ${resp.status}`,
          code: errorBody.error?.code || `http_${resp.status}`,
          status: resp.status,
        };
      }

      const data = await resp.json();
      return { ok: true, data, status: resp.status };
    } catch (err) {
      lastError = err;
      console.warn('[MS-Graph] Request error (attempt ' + attempts + '/' + MAX_RETRIES + '): ' + err.message);
      if (attempts < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY * attempts));
      }
    }
  }

  return { ok: false, error: lastError?.message || 'Erro após múltiplas tentativas', code: 'max_retries' };
}

/**
 * Uploads binary content to Graph API (e.g., OneDrive files).
 */
async function graphUpload(kv, userId, env, method, path, binaryBody, contentType) {
  const tokenResult = await getAccessToken(kv, userId, env);
  if (!tokenResult.ok) return { ok: false, error: tokenResult.error, code: tokenResult.code };

  const resp = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${tokenResult.accessToken}`,
      'Content-Type': contentType || 'application/octet-stream',
    },
    body: binaryBody,
  });

  if (!resp.ok) {
    let errorBody = {};
    try { errorBody = await resp.json(); } catch {}
    return { ok: false, error: errorBody.error?.message || `Upload failed: ${resp.status}`, code: errorBody.error?.code };
  }

  const data = await resp.json();
  return { ok: true, data };
}

/**
 * Downloads binary content from Graph API (e.g., OneDrive file content).
 */
async function graphDownload(kv, userId, env, path) {
  const tokenResult = await getAccessToken(kv, userId, env);
  if (!tokenResult.ok) return { ok: false, error: tokenResult.error, code: tokenResult.code };

  const resp = await fetch(`${GRAPH_BASE}${path}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenResult.accessToken}` },
  });

  if (!resp.ok) {
    let errorBody = {};
    try { errorBody = await resp.json(); } catch {}
    return { ok: false, error: errorBody.error?.message || `Download failed: ${resp.status}` };
  }

  const buffer = await resp.arrayBuffer();
  const contentType = resp.headers.get('content-type') || 'application/octet-stream';
  return { ok: true, buffer, contentType, headers: Object.fromEntries(resp.headers.entries()) };
}

// ─── Utility: User Profile ────────────────────────────────────────────────────

async function getUserProfile(kv, userId, env) {
  return graphRequest(kv, userId, env, 'GET', '/me?$select=id,displayName,mail,userPrincipalName,jobTitle,department');
}

// ─── Outlook Mail ─────────────────────────────────────────────────────────────

const MAIL_SELECT = 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,bodyPreview,isRead,hasAttachments,importance,inferenceClassification';
const MAIL_EXPAND = 'attachments($select=id,name,size,contentType)';

const MAIL = {
  // List messages in a folder
  async listMessages(kv, userId, env, folderId = 'inbox', params = {}) {
    const queryParams = new URLSearchParams({
      $top: (params.limit || 20).toString(),
      $skip: (params.offset || 0).toString(),
      $orderby: params.orderBy || 'receivedDateTime desc',
      $select: MAIL_SELECT,
    });
    if (params.expandAttachments) queryParams.set('$expand', MAIL_EXPAND);
    const url = `/me/mailFolders/${folderId}/messages?${queryParams}`;
    return graphRequest(kv, userId, env, 'GET', url);
  },

  // Get a specific message
  async getMessage(kv, userId, env, messageId) {
    const url = `/me/messages/${messageId}?$select=${MAIL_SELECT},body&$expand=${MAIL_EXPAND}`;
    return graphRequest(kv, userId, env, 'GET', url);
  },

  // Send a message
  async sendMessage(kv, userId, env, message) {
    const body = {
      message: {
        subject: message.subject || '',
        body: {
          contentType: message.isHtml ? 'HTML' : 'Text',
          content: message.body || '',
        },
        toRecipients: Array.isArray(message.to) ? message.to : [{ emailAddress: { address: message.to } }],
        ccRecipients: message.cc ? (Array.isArray(message.cc) ? message.cc : [{ emailAddress: { address: message.cc } }]) : [],
        bccRecipients: message.bcc ? (Array.isArray(message.bcc) ? message.bcc : [{ emailAddress: { address: message.bcc } }]) : [],
        importance: message.importance || 'normal',
      },
      saveToSentItems: message.saveToSentItems !== false,
    };

    // Add attachments
    if (message.attachments && message.attachments.length > 0) {
      body.message.attachments = message.attachments.map(a => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: a.name,
        contentType: a.contentType || 'application/octet-stream',
        contentBytes: a.contentBytes,
      }));
    }

    return graphRequest(kv, userId, env, 'POST', '/me/sendMail', { body });
  },

  // Send a draft
  async sendDraft(kv, userId, env, draftId) {
    return graphRequest(kv, userId, env, 'POST', `/me/messages/${draftId}/send`);
  },

  // Create a draft
  async createDraft(kv, userId, env, message) {
    const body = {
      subject: message.subject || '',
      body: {
        contentType: message.isHtml ? 'HTML' : 'Text',
        content: message.body || '',
      },
      toRecipients: Array.isArray(message.to) ? message.to : [{ emailAddress: { address: message.to } }],
    };
    return graphRequest(kv, userId, env, 'POST', '/me/messages', { body });
  },

  // Reply to a message
  async reply(kv, userId, env, messageId, reply) {
    const body = {
      message: {
        body: {
          contentType: reply.isHtml ? 'HTML' : 'Text',
          content: reply.body || '',
        },
        toRecipients: reply.to ? (Array.isArray(reply.to) ? reply.to : [{ emailAddress: { address: reply.to } }]) : [],
      },
      comment: reply.comment || '',
    };
    return graphRequest(kv, userId, env, 'POST', `/me/messages/${messageId}/reply`, { body });
  },

  // Reply All
  async replyAll(kv, userId, env, messageId, reply) {
    const body = {
      message: {
        body: {
          contentType: reply.isHtml ? 'HTML' : 'Text',
          content: reply.body || '',
        },
      },
      comment: reply.comment || '',
    };
    return graphRequest(kv, userId, env, 'POST', `/me/messages/${messageId}/replyAll`, { body });
  },

  // Forward a message
  async forward(kv, userId, env, messageId, forwardData) {
    const body = {
      toRecipients: Array.isArray(forwardData.to) ? forwardData.to : [{ emailAddress: { address: forwardData.to } }],
      comment: forwardData.comment || '',
    };
    return graphRequest(kv, userId, env, 'POST', `/me/messages/${messageId}/forward`, { body });
  },

  // Mark as read/unread
  async markRead(kv, userId, env, messageId, isRead = true) {
    return graphRequest(kv, userId, env, 'PATCH', `/me/messages/${messageId}`, {
      body: { isRead },
    });
  },

  // Move to folder
  async moveTo(kv, userId, env, messageId, destinationId) {
    return graphRequest(kv, userId, env, 'POST', `/me/messages/${messageId}/move`, {
      body: { destinationId },
    });
  },

  // Delete permanently
  async deleteMessage(kv, userId, env, messageId) {
    return graphRequest(kv, userId, env, 'DELETE', `/me/messages/${messageId}`);
  },

  // Search messages
  async searchMessages(kv, userId, env, query, params = {}) {
    const queryParams = new URLSearchParams({
      $search: `"${query}"`,
      $top: (params.limit || 20).toString(),
      $select: MAIL_SELECT,
    });
    return graphRequest(kv, userId, env, 'GET', `/me/messages?${queryParams}`);
  },

  // Get attachments
  async getAttachments(kv, userId, env, messageId) {
    return graphRequest(kv, userId, env, 'GET', `/me/messages/${messageId}/attachments?$select=id,name,size,contentType`);
  },

  // Download attachment content
  async downloadAttachment(kv, userId, env, messageId, attachmentId) {
    return graphRequest(kv, userId, env, 'GET', `/me/messages/${messageId}/attachments/${attachmentId}`);
  },

  // List mail folders
  async listFolders(kv, userId, env) {
    return graphRequest(kv, userId, env, 'GET', '/me/mailFolders?$select=id,displayName,totalItemCount,unreadItemCount,childFolderCount');
  },
};

// ─── Outlook Calendar ─────────────────────────────────────────────────────────

const CALENDAR_SELECT = 'id,subject,body,start,end,location,isAllDay,isCancelled,organizer,attendees,responseStatus,showAs,sensitivity,hasAttachments';

const CALENDAR = {
  // List calendar view (time range)
  async getCalendarView(kv, userId, env, startDateTime, endDateTime, params = {}) {
    const queryParams = new URLSearchParams({
      startDateTime,
      endDateTime,
      $top: (params.limit || 100).toString(),
      $select: CALENDAR_SELECT,
    });
    return graphRequest(kv, userId, env, 'GET', `/me/calendarView?${queryParams}`);
  },

  // List events in a specific calendar
  async getEvents(kv, userId, env, calendarId = null, params = {}) {
    const path = calendarId
      ? `/me/calendars/${calendarId}/events?$top=${params.limit || 50}&$select=${CALENDAR_SELECT}`
      : `/me/events?$top=${params.limit || 50}&$select=${CALENDAR_SELECT}`;
    return graphRequest(kv, userId, env, 'GET', path);
  },

  // Get a specific event
  async getEvent(kv, userId, env, eventId) {
    return graphRequest(kv, userId, env, 'GET', `/me/events/${eventId}?$select=${CALENDAR_SELECT}`);
  },

  // Create an event
  async createEvent(kv, userId, env, event) {
    const body = {
      subject: event.subject || event.title || 'Sem título',
      body: {
        contentType: event.body?.contentType || 'HTML',
        content: event.body?.content || event.description || '',
      },
      start: {
        dateTime: event.start?.dateTime || `${event.date}T${event.time || '09:00'}`,
        timeZone: event.start?.timeZone || 'America/Sao_Paulo',
      },
      end: {
        dateTime: event.end?.dateTime || `${event.date}T${event.endTime || '10:00'}`,
        timeZone: event.end?.timeZone || 'America/Sao_Paulo',
      },
      location: event.location ? { displayName: event.location } : undefined,
      isAllDay: event.isAllDay || false,
      attendees: event.attendees || [],
      showAs: event.showAs || 'busy',
      sensitivity: event.sensitivity || 'normal',
      reminderMinutesBeforeStart: event.reminder || 15,
      isReminderOn: event.reminder !== 0,
    };

    const path = event.calendarId
      ? `/me/calendars/${event.calendarId}/events`
      : '/me/events';
    return graphRequest(kv, userId, env, 'POST', path, { body });
  },

  // Update an event
  async updateEvent(kv, userId, env, eventId, event) {
    const body = {};
    if (event.subject || event.title) body.subject = event.subject || event.title;
    if (event.body) body.body = event.body;
    if (event.start) body.start = event.start;
    if (event.end) body.end = event.end;
    if (event.location) body.location = { displayName: event.location };
    if (event.isAllDay !== undefined) body.isAllDay = event.isAllDay;
    if (event.attendees) body.attendees = event.attendees;
    if (event.reminder !== undefined) {
      body.reminderMinutesBeforeStart = event.reminder;
      body.isReminderOn = event.reminder > 0;
    }

    return graphRequest(kv, userId, env, 'PATCH', `/me/events/${eventId}`, { body });
  },

  // Delete an event
  async deleteEvent(kv, userId, env, eventId) {
    return graphRequest(kv, userId, env, 'DELETE', `/me/events/${eventId}`);
  },

  // Accept an event invitation
  async acceptEvent(kv, userId, env, eventId, params = {}) {
    const body = {
      comment: params.comment || '',
      sendResponse: params.sendResponse !== false,
      proposedNewTime: params.proposedNewTime || undefined,
    };
    return graphRequest(kv, userId, env, 'POST', `/me/events/${eventId}/accept`, { body });
  },

  // Decline an event invitation
  async declineEvent(kv, userId, env, eventId, params = {}) {
    const body = {
      comment: params.comment || '',
      sendResponse: params.sendResponse !== false,
    };
    return graphRequest(kv, userId, env, 'POST', `/me/events/${eventId}/decline`, { body });
  },

  // Tentatively accept an event
  async tentativelyAcceptEvent(kv, userId, env, eventId, params = {}) {
    const body = {
      comment: params.comment || '',
      sendResponse: params.sendResponse !== false,
      proposedNewTime: params.proposedNewTime || undefined,
    };
    return graphRequest(kv, userId, env, 'POST', `/me/events/${eventId}/tentativelyAccept`, { body });
  },

  // Propose new time (reschedule)
  async proposeNewTime(kv, userId, env, eventId, newStart, newEnd, params = {}) {
    const body = {
      proposedNewTime: {
        start: newStart,
        end: newEnd,
      },
      informationAction: params.informationAction || 'TentativelyAccepted',
      comment: params.comment || '',
    };
    return graphRequest(kv, userId, env, 'POST', `/me/events/${eventId}/tentativelyAccept`, { body });
  },

  // List calendars
  async listCalendars(kv, userId, env) {
    return graphRequest(kv, userId, env, 'GET', '/me/calendars?$select=id,name,color,canEdit,canShare');
  },

  // Create a calendar
  async createCalendar(kv, userId, env, name, color = 'auto') {
    return graphRequest(kv, userId, env, 'POST', '/me/calendars', {
      body: { name, color },
    });
  },
};

// ─── OneDrive ─────────────────────────────────────────────────────────────────

const FILE_SELECT = 'id,name,size,file,folder,mimeType,createdDateTime,lastModifiedDateTime,parentReference,webUrl';

const ONEDRIVE = {
  // Get user's OneDrive root
  async getRoot(kv, userId, env) {
    return graphRequest(kv, userId, env, 'GET', '/me/drive/root?$select=' + FILE_SELECT);
  },

  // List items in a folder
  async listItems(kv, userId, env, driveItemId, params = {}) {
    const path = driveItemId
      ? `/me/drive/items/${driveItemId}/children?$select=${FILE_SELECT}&$top=${params.limit || 100}`
      : '/me/drive/root/children?$select=' + FILE_SELECT;
    return graphRequest(kv, userId, env, 'GET', path);
  },

  // Get item details
  async getItem(kv, userId, env, driveItemId) {
    return graphRequest(kv, userId, env, 'GET', `/me/drive/items/${driveItemId}?$select=${FILE_SELECT}`);
  },

  // Get item by path
  async getItemByPath(kv, userId, env, path) {
    return graphRequest(kv, userId, env, 'GET', `/me/drive/root:/${path}:?$select=${FILE_SELECT}`);
  },

  // Create a folder
  async createFolder(kv, userId, env, parentItemId, name) {
    const body = {
      name,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    };
    const path = parentItemId
      ? `/me/drive/items/${parentItemId}/children`
      : '/me/drive/root/children';
    return graphRequest(kv, userId, env, 'POST', path, { body });
  },

  // Create an empty file (placeholder)
  async createFile(kv, userId, env, parentItemId, name, content) {
    const body = {
      name,
      file: {},
      '@microsoft.graph.conflictBehavior': 'rename',
    };
    const path = parentItemId
      ? `/me/drive/items/${parentItemId}/children`
      : '/me/drive/root/children';
    const createResult = await graphRequest(kv, userId, env, 'POST', path, { body });
    if (!createResult.ok) return createResult;

    // Upload content if provided
    if (content) {
      const itemId = createResult.data.id;
      return graphUpload(kv, userId, env, 'PUT', `/me/drive/items/${itemId}/content`, content, 'text/plain');
    }
    return createResult;
  },

  // Upload a file (up to 4MB — simple upload)
  async uploadFile(kv, userId, env, parentItemId, fileName, content, contentType) {
    const path = parentItemId
      ? `/me/drive/items/${parentItemId}:/${encodeURIComponent(fileName)}:/content`
      : `/me/drive/root:/${encodeURIComponent(fileName)}:/content`;
    return graphUpload(kv, userId, env, 'PUT', path, content, contentType || 'application/octet-stream');
  },

  // Get @microsoft.graph.downloadUrl for a file
  async getDownloadUrl(kv, userId, env, driveItemId) {
    return graphRequest(kv, userId, env, 'GET', `/me/drive/items/${driveItemId}?select=@microsoft.graph.downloadUrl`);
  },

  // Download a file
  async downloadFile(kv, userId, env, driveItemId) {
    const tokenResult = await getAccessToken(kv, userId, env);
    if (!tokenResult.ok) return { ok: false, error: tokenResult.error, code: tokenResult.code };

    const resp = await fetch(`${GRAPH_BASE}/me/drive/items/${driveItemId}/content`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenResult.accessToken}` },
    });

    if (!resp.ok) {
      let errorBody = {};
      try { errorBody = await resp.json(); } catch {}
      return { ok: false, error: errorBody.error?.message || `Download failed: ${resp.status}` };
    }

    const buffer = await resp.arrayBuffer();
    const contentType = resp.headers.get('content-type') || 'application/octet-stream';
    return { ok: true, buffer, contentType };
  },

  // Delete an item
  async deleteItem(kv, userId, env, driveItemId) {
    return graphRequest(kv, userId, env, 'DELETE', `/me/drive/items/${driveItemId}`);
  },

  // Rename an item
  async renameItem(kv, userId, env, driveItemId, newName) {
    return graphRequest(kv, userId, env, 'PATCH', `/me/drive/items/${driveItemId}`, {
      body: { name: newName },
    });
  },

  // Move an item
  async moveItem(kv, userId, env, driveItemId, targetParentId) {
    return graphRequest(kv, userId, env, 'PATCH', `/me/drive/items/${driveItemId}`, {
      body: { parentReference: { id: targetParentId } },
    });
  },

  // Share an item (create sharing link)
  async shareItem(kv, userId, env, driveItemId, type = 'view', scope = 'anonymous') {
    return graphRequest(kv, userId, env, 'POST', `/me/drive/items/${driveItemId}/createLink`, {
      body: { type, scope },
    });
  },

  // Create sharing invitation
  async inviteSharing(kv, userId, env, driveItemId, recipients, message = '', requireSignIn = false) {
    return graphRequest(kv, userId, env, 'POST', `/me/drive/items/${driveItemId}/invite`, {
      body: {
        recipients,
        message,
        requireSignIn,
        roles: ['read'],
      },
    });
  },

  // Add to favorites
  async addToRecent(kv, userId, env, driveItemId) {
    return graphRequest(kv, userId, env, 'POST', `/me/drive/recent`);
  },

  // Get recent items
  async getRecent(kv, userId, env, params = {}) {
    return graphRequest(kv, userId, env, 'GET', `/me/drive/recent?$top=${params.limit || 20}&$select=${FILE_SELECT}`);
  },

  // Search items
  async searchItems(kv, userId, env, query, params = {}) {
    return graphRequest(kv, userId, env, 'GET', `/me/drive/search(q='${encodeURIComponent(query)}')?$top=${params.limit || 20}&$select=${FILE_SELECT}`);
  },

  // Get sharing permissions
  async getPermissions(kv, userId, env, driveItemId) {
    return graphRequest(kv, userId, env, 'GET', `/me/drive/items/${driveItemId}/permissions`);
  },

  // Revoke sharing permission
  async revokePermission(kv, userId, env, driveItemId, permissionId) {
    return graphRequest(kv, userId, env, 'DELETE', `/me/drive/items/${driveItemId}/permissions/${permissionId}`);
  },
};

// ─── Teams ────────────────────────────────────────────────────────────────────

const TEAMS = {
  // List joined teams
  async listTeams(kv, userId, env) {
    return graphRequest(kv, userId, env, 'GET', '/me/joinedTeams?$select=id,displayName,description,visibility,webUrl');
  },

  // List channels in a team
  async listChannels(kv, userId, env, teamId) {
    return graphRequest(kv, userId, env, 'GET', `/teams/${teamId}/channels?$select=id,displayName,description,webUrl,email`);
  },

  // Get messages in a channel
  async listChannelMessages(kv, userId, env, teamId, channelId, params = {}) {
    return graphRequest(kv, userId, env, 'GET', `/teams/${teamId}/channels/${channelId}/messages?$top=${params.limit || 20}&$expand=replies`);
  },

  // Send a message to a channel
  async sendMessage(kv, userId, env, teamId, channelId, message) {
    const body = {
      body: {
        contentType: message.isHtml ? 'html' : 'text',
        content: message.content || message.body || '',
      },
      subject: message.subject || undefined,
    };
    return graphRequest(kv, userId, env, 'POST', `/teams/${teamId}/channels/${channelId}/messages`, { body });
  },

  // Reply to a channel message
  async replyMessage(kv, userId, env, teamId, channelId, messageId, reply) {
    const body = {
      body: {
        contentType: reply.isHtml ? 'html' : 'text',
        content: reply.content || reply.body || '',
      },
    };
    return graphRequest(kv, userId, env, 'POST', `/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`, { body });
  },

  // Get a specific channel message
  async getMessage(kv, userId, env, teamId, channelId, messageId) {
    return graphRequest(kv, userId, env, 'GET', `/teams/${teamId}/channels/${channelId}/messages/${messageId}`);
  },

  // Delete a channel message
  async deleteMessage(kv, userId, env, teamId, channelId, messageId) {
    return graphRequest(kv, userId, env, 'DELETE', `/teams/${teamId}/channels/${channelId}/messages/${messageId}`);
  },

  // List team files (root drive)
  async listTeamFiles(kv, userId, env, teamId) {
    return graphRequest(kv, userId, env, 'GET', `/teams/${teamId}/drive/root/children?$select=${FILE_SELECT}`);
  },

  // Get team tabs
  async listTabs(kv, userId, env, teamId, channelId) {
    return graphRequest(kv, userId, env, 'GET', `/teams/${teamId}/channels/${channelId}/tabs?$select=id,displayName,teamsApp`);
  },
};

// ─── Connections / Sync ───────────────────────────────────────────────────────

const CONNECTIONS = {
  async getProfile(kv, userId, env) {
    return graphRequest(kv, userId, env, 'GET', '/me?$select=id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation');
  },

  async testConnection(kv, userId, env) {
    const result = await graphRequest(kv, userId, env, 'GET', '/me?$select=id,displayName');
    if (result.ok) {
      return { ok: true, profile: { displayName: result.data.displayName, mail: result.data.mail, userId: result.data.id } };
    }
    return result;
  },

  async revokeConnection(kv, userId, env) {
    // Clear local tokens (server-side revocation requires Azure AD API key)
    const keys = [
      `oauth:token:${userId}:microsoft_365`,
      `integration:${userId}:microsoft_365`,
      `oauth:${userId}:microsoft`,
      `comm:connections:${userId}`,
    ];
    for (const key of keys) {
      try { await kv.delete(key); } catch {}
    }
    return { ok: true, message: 'Microsoft desconectado' };
  },
};

// ─── Exports ──────────────────────────────────────────────────────────────────

export {
  GRAPH_BASE,
  GRAPH_BETA,
  TOKEN_URL,
  getAccessToken,
  refreshAccessToken,
  graphRequest,
  graphUpload,
  graphDownload,
  getUserProfile,
  MAIL,
  CALENDAR,
  ONEDRIVE,
  TEAMS,
  CONNECTIONS,
};
