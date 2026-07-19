import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const code = await readFile(resolve(root, 'premium_ui/admin_completion.js'), 'utf8');

const screens = ['overview','analytics','crm','users','organizations','billing','subscriptions','plans','workspaces','audit','logs','security','system','integrations','features'];
// Mapeamento especial: overview -> renderDashboard, crm -> renderCRM
const rendererMap = {
  overview: 'renderDashboard(',
  crm: 'renderCRM(',
};
const renderers = screens.map(s => ({
  screen: s,
  hasRenderer: code.includes(rendererMap[s] || ('render' + s.charAt(0).toUpperCase() + s.slice(1) + '(')),
  hasRoute: code.includes("'" + s + "'"),
}));

console.log('=== COBERTURA DE TELAS ===');
renderers.forEach(r => console.log(r.screen.padEnd(20), r.hasRenderer ? '✓ renderer' : '✗ SEM RENDERER', r.hasRoute ? '✓ route' : '✗ SEM ROUTE'));

const issues = renderers.filter(r => !r.hasRenderer || !r.hasRoute);
console.log('\n=== PROBLEMAS ===');
if (issues.length === 0) console.log('Nenhum problema encontrado.');
else issues.forEach(r => console.log('PROBLEMA:', r.screen, !r.hasRenderer ? '(sem renderer)' : '', !r.hasRoute ? '(sem route)' : ''));

const components = ['skeletonView','emptyView','errorView','toast','openForm','paginationBar','tableView','toolbar','pageTopbar','stat'];
console.log('\n=== COMPONENTES UX ===');
components.forEach(c => console.log(c.padEnd(20), code.includes(c) ? '✓' : '✗ AUSENTE'));

const actions = ['invite-user','edit-user','toggle-user','delete-user','create-org','edit-org','toggle-org','archive-org','create-workspace','edit-workspace','archive-workspace','create-plan','edit-plan','archive-plan','create-subscription','edit-subscription','cancel-subscription','create-flag','toggle-flag','delete-flag','clear-logs','revoke-sessions','edit-system','clear-cache','disconnect-integration','export','bulk'];
console.log('\n=== ACTIONS DE BOTÕES ===');
let missingActions = 0;
actions.forEach(a => {
  const found = code.includes("'" + a + "'");
  console.log(a.padEnd(30), found ? '✓' : '✗ AUSENTE');
  if (!found) missingActions++;
});

console.log('\n=== TAMANHO ===');
console.log('Linhas:', code.split('\n').length);
console.log('Bytes:', Buffer.byteLength(code, 'utf8'));
console.log('\n=== RESUMO ===');
console.log('Telas com problema:', issues.length);
console.log('Actions ausentes:', missingActions);
if (issues.length === 0 && missingActions === 0) {
  console.log('STATUS: ✓ AUDITORIA APROVADA');
} else {
  console.log('STATUS: ✗ REQUER CORREÇÃO');
}
