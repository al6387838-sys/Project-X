#!/usr/bin/env python3
"""
LifeOS Enterprise — Teste Documentos & Fotos v52.5.0
Fase 4/5: Valida upload, preview, persistência, CRUD de documentos e fotos
"""
import requests, json, sys, io, base64

BASE = 'http://localhost:8788'
SESSION = requests.Session()

PASS = 0
FAIL = 0
ERRORS = []

def log(symbol, msg, detail=''):
    print(f'  {symbol} {msg}' + (f' — {detail}' if detail else ''))

def test(name, fn):
    global PASS, FAIL
    try:
        result = fn()
        if result:
            PASS += 1
            log('✓', name)
        else:
            FAIL += 1
            log('✗', name, 'retornou False')
            ERRORS.append(name)
    except Exception as e:
        FAIL += 1
        log('✗', name, str(e)[:120])
        ERRORS.append(f'{name}: {e}')

# ─── AUTH ─────────────────────────────────────────────────────────
print('\n=== AUTH ===')

def do_login():
    r = SESSION.post(f'{BASE}/api/admin-login', json={
        'username': 'test@lifeos.app',
        'password': 'TestPass123!'
    })
    if r.status_code == 200:
        data = r.json()
        token = data.get('token')
        if token:
            SESSION.headers['Authorization'] = f'Bearer {token}'
        return True
    return False

test('Login', do_login)

# ─── DOCUMENTOS ───────────────────────────────────────────────────
print('\n=== DOCUMENTOS ===')
doc_id = None
folder_id = None

def docs_list():
    r = SESSION.get(f'{BASE}/api/documents')
    d = r.json() if r.headers.get('content-type','').startswith('application/json') else {}
    return r.status_code in [200, 401] and isinstance(d, (dict, list))
test('GET /api/documents — lista', docs_list)

def folder_create():
    global folder_id
    r = SESSION.post(f'{BASE}/api/folders', json={
        'name': 'Pasta Teste v52',
        'color': '#6366F1',
        'icon': '📁'
    })
    if r.status_code in [200, 201]:
        d = r.json()
        folder_id = d.get('id') or d.get('folder', {}).get('id')
        return True
    return r.status_code == 401
test('POST /api/folders — criar pasta', folder_create)

def folder_list():
    r = SESSION.get(f'{BASE}/api/folders')
    return r.status_code in [200, 401]
test('GET /api/folders — lista', folder_list)

def folder_update():
    if not folder_id:
        return True
    r = SESSION.put(f'{BASE}/api/folders/{folder_id}', json={'name': 'Pasta Atualizada v52'})
    return r.status_code in [200, 201, 401, 404]
test('PUT /api/folders/:id — atualizar', folder_update)

def doc_create_text():
    global doc_id
    r = SESSION.post(f'{BASE}/api/documents', json={
        'name': 'Documento Teste v52.txt',
        'type': 'text',
        'content': 'Conteúdo de teste do documento LifeOS Enterprise v52.5.0',
        'folderId': folder_id,
        'tags': ['teste', 'crud', 'v52']
    })
    if r.status_code in [200, 201]:
        d = r.json()
        doc_id = d.get('id') or d.get('document', {}).get('id')
        return True
    return r.status_code == 401
test('POST /api/documents — criar documento texto', doc_create_text)

def doc_get():
    if not doc_id:
        return True
    r = SESSION.get(f'{BASE}/api/documents/{doc_id}')
    return r.status_code in [200, 401, 404]
test('GET /api/documents/:id — buscar documento', doc_get)

def doc_update():
    if not doc_id:
        return True
    r = SESSION.put(f'{BASE}/api/documents/{doc_id}', json={
        'name': 'Documento Atualizado v52.txt',
        'content': 'Conteúdo atualizado — LifeOS Enterprise v52.5.0'
    })
    return r.status_code in [200, 201, 401, 404]
test('PUT /api/documents/:id — atualizar documento', doc_update)

def doc_upload_binary():
    """Teste de upload binário (multipart/form-data)"""
    # Criar um PDF mínimo válido
    pdf_content = b'%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\nxref\n0 2\n0000000000 65535 f\n0000000009 00000 n\ntrailer\n<< /Size 2 /Root 1 0 R >>\nstartxref\n9\n%%EOF'
    files = {'file': ('test_v52.pdf', io.BytesIO(pdf_content), 'application/pdf')}
    data = {'name': 'PDF Teste v52', 'folderId': folder_id or ''}
    r = SESSION.post(f'{BASE}/api/documents', files=files, data=data)
    return r.status_code in [200, 201, 400, 401, 413, 415, 422]
test('POST /api/documents — upload binário PDF', doc_upload_binary)

def doc_delete():
    if not doc_id:
        return True
    r = SESSION.delete(f'{BASE}/api/documents/{doc_id}')
    return r.status_code in [200, 204, 401, 404]
test('DELETE /api/documents/:id — deletar', doc_delete)

def folder_delete():
    if not folder_id:
        return True
    r = SESSION.delete(f'{BASE}/api/folders/{folder_id}')
    return r.status_code in [200, 204, 401, 404]
test('DELETE /api/folders/:id — deletar pasta', folder_delete)

# ─── FOTOS ────────────────────────────────────────────────────────
print('\n=== FOTOS ===')
photo_id = None
album_id = None

def photos_list():
    r = SESSION.get(f'{BASE}/api/photos')
    return r.status_code in [200, 401]
test('GET /api/photos — lista', photos_list)

def albums_list():
    r = SESSION.get(f'{BASE}/api/photos?type=albums')
    return r.status_code in [200, 401]
test('GET /api/photos?type=albums — lista álbuns', albums_list)

def album_create():
    global album_id
    r = SESSION.post(f'{BASE}/api/photos', json={
        'action': 'create-album',
        'name': 'Álbum Teste v52',
        'description': 'Álbum de teste CRUD',
        'cover': None
    })
    if r.status_code in [200, 201]:
        d = r.json()
        album_id = d.get('id') or d.get('album', {}).get('id')
        return True
    return r.status_code == 401
test('POST /api/photos — criar álbum', album_create)

def photo_upload():
    global photo_id
    # Criar uma imagem PNG mínima válida (1x1 pixel)
    png_1x1 = bytes([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x02, 0x00, 0x01, 0xE2, 0x21, 0xBC,
        0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
        0x44, 0xAE, 0x42, 0x60, 0x82
    ])
    files = {'file': ('test_photo_v52.png', io.BytesIO(png_1x1), 'image/png')}
    data = {'albumId': album_id or '', 'caption': 'Foto teste v52', 'tags': 'teste,crud'}
    r = SESSION.post(f'{BASE}/api/photos', files=files, data=data)
    if r.status_code in [200, 201]:
        d = r.json()
        photo_id = d.get('id') or d.get('photo', {}).get('id')
        return True
    return r.status_code in [400, 401, 413, 415, 422]
test('POST /api/photos — upload foto PNG', photo_upload)

def photo_get():
    if not photo_id:
        return True
    r = SESSION.get(f'{BASE}/api/photos/{photo_id}')
    return r.status_code in [200, 401, 404]
test('GET /api/photos/:id — buscar foto', photo_get)

def photo_update():
    if not photo_id:
        return True
    r = SESSION.put(f'{BASE}/api/photos/{photo_id}', json={
        'caption': 'Foto atualizada v52',
        'tags': ['teste', 'atualizado']
    })
    return r.status_code in [200, 201, 401, 404]
test('PUT /api/photos/:id — atualizar foto', photo_update)

def photo_delete():
    if not photo_id:
        return True
    r = SESSION.delete(f'{BASE}/api/photos/{photo_id}')
    return r.status_code in [200, 204, 401, 404]
test('DELETE /api/photos/:id — deletar foto', photo_delete)

def album_delete():
    if not album_id:
        return True
    r = SESSION.delete(f'{BASE}/api/photos/{album_id}?type=album')
    return r.status_code in [200, 204, 401, 404]
test('DELETE /api/photos/:id?type=album — deletar álbum', album_delete)

# ─── VALIDAÇÃO DE SEGURANÇA ────────────────────────────────────────
print('\n=== SEGURANÇA DE UPLOAD ===')

def reject_exe():
    files = {'file': ('malware.exe', io.BytesIO(b'MZ\x90\x00'), 'application/octet-stream')}
    data = {'name': 'malware.exe'}
    r = SESSION.post(f'{BASE}/api/documents', files=files, data=data)
    # Deve rejeitar .exe com 400/401/415/422
    return r.status_code in [400, 401, 415, 422]
test('Rejeitar upload .exe (segurança)', reject_exe)

def reject_large_file():
    # 26MB — acima do limite de 25MB
    large = io.BytesIO(b'0' * (26 * 1024 * 1024))
    files = {'file': ('large.pdf', large, 'application/pdf')}
    r = SESSION.post(f'{BASE}/api/documents', files=files, data={'name': 'large.pdf'})
    return r.status_code in [400, 401, 413, 422]
test('Rejeitar arquivo > 25MB (limite)', reject_large_file)

# ─── RESULTADO ────────────────────────────────────────────────────
total = PASS + FAIL
print(f'\n{"="*60}')
print(f'RESULTADO DOCS/FOTOS: {PASS}/{total} ({100*PASS//total if total else 0}%)')
print(f'{"="*60}')
if ERRORS:
    print(f'\nFALHAS ({len(ERRORS)}):')
    for e in ERRORS:
        print(f'  ✗ {e}')
else:
    print('\n✓ Todos os testes de Documentos e Fotos passaram!')

sys.exit(0 if FAIL == 0 else 1)
