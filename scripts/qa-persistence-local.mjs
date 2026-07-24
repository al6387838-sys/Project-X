import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createSession } from '../functions/_auth.js';

const baseURL = process.env.QA_BASE_URL || 'http://127.0.0.1:8788';
const secret = process.env.LIFEOS_SESSION_SECRET || 'qa-local-session-secret';
const statePath = process.env.QA_STATE_PATH || '/tmp/lifeos-persistence-qa.json';
const mode = process.argv[2] || 'seed';
const owner = 'persistencia.qa@lifeos.test';

async function tokenFor(userId) {
  return createSession(userId, 'user', secret);
}

async function api(path, { method = 'GET', body, form = false, userId = owner } = {}) {
  const headers = { cookie: `lifeos_session=${await tokenFor(userId)}` };
  const init = { method, headers };
  if (body !== undefined) {
    if (form) init.body = body;
    else {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
  }
  const response = await fetch(`${baseURL}${path}`, init);
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok || (typeof data === 'object' && data && !data.ok)) {
    throw new Error(`${method} ${path}: ${typeof data === 'string' ? data : data?.error || response.status}`);
  }
  return { response, data };
}

if (mode === 'seed') {
  const folder = await api('/api/documents', { method: 'POST', body: { action: 'create-folder', name: 'Pasta Persistência QA' } });
  const documentForm = new FormData();
  documentForm.append('action', 'upload');
  documentForm.append('folderId', folder.data.folder.id);
  documentForm.append('file', new File(['conteúdo persistente de documento'], 'persistencia.txt', { type: 'text/plain' }));
  const document = await api('/api/documents', { method: 'POST', body: documentForm, form: true });

  const album = await api('/api/photos', { method: 'POST', body: { action: 'create-album', name: 'Álbum Persistência QA' } });
  const photoForm = new FormData();
  photoForm.append('albumId', album.data.album.id);
  photoForm.append('file', new File(['conteúdo persistente de foto'], 'persistencia.jpg', { type: 'image/jpeg' }));
  const photo = await api('/api/photos', { method: 'POST', body: photoForm, form: true });

  const state = {
    owner,
    folderId: folder.data.folder.id,
    documentId: document.data.document.id,
    albumId: album.data.album.id,
    photoId: photo.data.photo.id,
  };
  await writeFile(statePath, JSON.stringify(state, null, 2) + '\n');
  console.log(JSON.stringify({ mode, state }));
} else if (mode === 'verify') {
  const state = JSON.parse(await readFile(statePath, 'utf8'));
  const documents = await api(`/api/documents?view=list&folderId=${encodeURIComponent(state.folderId)}`, { userId: state.owner });
  assert.equal(documents.data.documents.some(document => document.id === state.documentId), true, 'Documento não persistiu após reinicialização.');
  const documentContent = await api(`/api/documents?view=content&docId=${encodeURIComponent(state.documentId)}`, { userId: state.owner });
  assert.equal(documentContent.data, 'conteúdo persistente de documento');

  const photos = await api(`/api/photos?view=list&albumId=${encodeURIComponent(state.albumId)}`, { userId: state.owner });
  assert.equal(photos.data.photos.some(photo => photo.id === state.photoId), true, 'Foto não persistiu após reinicialização.');
  const photoContent = await api(`/api/photos?view=content&photoId=${encodeURIComponent(state.photoId)}`, { userId: state.owner });
  assert.equal(photoContent.data, 'conteúdo persistente de foto');
  console.log(JSON.stringify({ mode, documentPersisted: true, photoPersisted: true, folderId: state.folderId, albumId: state.albumId }));
} else {
  throw new Error(`Modo inválido: ${mode}`);
}
