import { readFile, writeFile, unlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const htmlPath = resolve(root, 'dist/modules/file-center.html');
const tmpJs = resolve(root, 'dist/modules/_fc_qa_tmp.js');

const html = await readFile(htmlPath, 'utf8');

// Extrair conteúdo do <script>
const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
if (!scriptMatch) {
  console.error('❌ Nenhum script encontrado no file-center.html');
  process.exit(1);
}

const js = scriptMatch[1];
await writeFile(tmpJs, js);

try {
  execFileSync('node', ['--check', tmpJs], { encoding: 'utf8' });
  console.log('✅ Sintaxe JS do file-center.html: OK');
} catch (err) {
  console.error('❌ Erro de sintaxe no file-center.html:');
  console.error(err.stderr || err.message);
  await unlink(tmpJs).catch(() => {});
  process.exit(1);
}

// Verificar funções críticas
const checks = [
  { name: 'window.fcLoad', pattern: /window\.fcLoad\s*=/ },
  { name: 'window.fcUpload', pattern: /window\.fcUpload\s*=/ },
  { name: 'window.fcDownload', pattern: /window\.fcDownload\s*=/ },
  { name: 'fcOpenViewer (preview)', pattern: /window\.fcOpenViewer\s*=|fcOpenViewer/ },
  { name: 'fcRenderPreview (preview)', pattern: /function fcRenderPreview|fcRenderPreview\s*=/ },
  { name: 'window.fcCreateFolder', pattern: /window\.fcCreateFolder\s*=/ },
  { name: 'fcRenameActive', pattern: /window\.fcRenameActive\s*=|fcRenameActive/ },
  { name: 'fcMoveActive / fcMoveToFolder', pattern: /window\.fcMoveActive\s*=|fcMoveToFolder/ },
  { name: 'fcCopyActive', pattern: /window\.fcCopyActive\s*=|fcCopyActive/ },
  { name: 'fcDeleteItem', pattern: /window\.fcDeleteItem\s*=|fcDeleteItem/ },
  { name: 'window.fcRestore', pattern: /window\.fcRestore\s*=/ },
  { name: 'window.fcToggleFavorite', pattern: /window\.fcToggleFavorite\s*=/ },
  { name: 'fcShareActive', pattern: /window\.fcShareActive\s*=|fcShareActive/ },
  { name: 'window.fcEmptyTrash', pattern: /window\.fcEmptyTrash\s*=/ },
  { name: 'window.fcPermanentDelete', pattern: /window\.fcPermanentDelete\s*=/ },
  { name: 'window.fcDownloadActive', pattern: /window\.fcDownloadActive\s*=/ },
  { name: 'window.fcBackToList', pattern: /window\.fcBackToList\s*=/ },
  { name: 'fcShowSection (navegação)', pattern: /window\.fcShowSection\s*=|fcShowSection/ },
  { name: 'fcRender (renderização)', pattern: /function fcRender|fcRender\s*=/ },
  { name: 'Single Source of Truth (view=stats)', pattern: /view.*stats|stats.*view/ },
  { name: 'API endpoint /api/documents', pattern: /\/api\/documents/ },
  { name: 'Upload multipart FormData', pattern: /FormData/ },
  { name: 'Preview PDF (iframe)', pattern: /iframe|pdf/i },
  { name: 'Preview imagem (img)', pattern: /<img|createElement.*img/i },
  { name: 'Preview vídeo (video)', pattern: /<video|createElement.*video/i },
  { name: 'Seção Lixeira (trash)', pattern: /S\.section.*trash|section.*trash/i },
  { name: 'Seção Favoritos (favorites)', pattern: /S\.section.*favorites|section.*favorites/i },
  { name: 'Drag and drop', pattern: /dragover|dragstart|drop/i },
  { name: 'Confirmação exclusão permanente', pattern: /Excluir permanentemente|confirm.*perm|perm.*exclu/i },
  { name: 'targetUserId (share)', pattern: /targetUserId/ },
  { name: 'dl=1 (download forçado)', pattern: /dl=1/ },
  { name: 'Contadores sincronizados (S.stats)', pattern: /S\.stats/ },
  { name: 'Stats do backend (statsData)', pattern: /statsData/ },
];

let allOk = true;
for (const check of checks) {
  const found = check.pattern.test(js);
  const icon = found ? '✅' : '❌';
  if (!found) allOk = false;
  console.log(`${icon} ${check.name}`);
}

// Verificar HTML do módulo
const htmlChecks = [
  { name: 'KPI total (fc-stat-total)', pattern: /fc-stat-total/ },
  { name: 'KPI favoritos (fc-stat-favorites)', pattern: /fc-stat-favorites/ },
  { name: 'KPI tamanho (fc-stat-size)', pattern: /fc-stat-size/ },
  { name: 'KPI lixeira (fc-stat-trash)', pattern: /fc-stat-trash/ },
  { name: 'Botão Lixeira (fc-btn-trash)', pattern: /fc-btn-trash/ },
  { name: 'Botão Favoritos (fc-btn-fav)', pattern: /fc-btn-fav/ },
  { name: 'Painel de preview (fc-viewer)', pattern: /fc-viewer/ },
  { name: 'Modal de upload (fc-upload-modal)', pattern: /fc-upload-modal/ },
  { name: 'Modal de confirmação', pattern: /fc-confirm-modal|confirm.*modal/i },
  { name: 'Modal de compartilhamento', pattern: /fc-share-modal|share.*modal/i },
  { name: 'Modal de renomear', pattern: /fc-rename-modal|rename.*modal/i },
  { name: 'Modal de mover', pattern: /fc-move-modal|move.*modal/i },
  { name: 'Breadcrumb (fc-breadcrumb)', pattern: /fc-breadcrumb/ },
  { name: 'Área de drop (fc-drop-zone)', pattern: /fc-drop-zone|drop.zone/i },
];

console.log('\n--- HTML ---');
for (const check of htmlChecks) {
  const found = check.pattern.test(html);
  const icon = found ? '✅' : '❌';
  if (!found) allOk = false;
  console.log(`${icon} ${check.name}`);
}

await unlink(tmpJs).catch(() => {});

console.log('\n' + (allOk ? '✅ QA PASSOU — Todas as verificações OK' : '⚠️  QA FALHOU — Verificar itens acima'));
process.exit(allOk ? 0 : 1);
