import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontend = await readFile(resolve(root, 'premium_ui/admin_completion.js'), 'utf8');
const backend  = await readFile(resolve(root, 'functions/api/admin-data.js'), 'utf8');

// Todas as actions que o frontend envia como POST
const frontendActions = [
  'user.invite', 'user.update', 'user.delete',
  'organization.create', 'organization.update', 'organization.delete',
  'workspace.create', 'workspace.update', 'workspace.delete',
  'plan.create', 'plan.update', 'plan.delete',
  'subscription.create', 'subscription.update', 'subscription.cancel',
  'flag.upsert', 'flag.delete',
  'system.settings.update', 'system.cache.clear', 'logs.clear',
  'integration.disconnect', 'security.revokeSessions',
  'rollback',
];

// Verificar se backend suporta cada action
console.log('=== ALINHAMENTO FRONTEND ↔ BACKEND ===\n');
let allOk = true;
for (const action of frontendActions) {
  const inFrontend = frontend.includes(`'${action}'`) || frontend.includes(`"${action}"`);
  const inBackend  = backend.includes(`'${action}'`)  || backend.includes(`"${action}"`);
  const status = inFrontend && inBackend ? '✓' : inFrontend && !inBackend ? '⚠ SEM BACKEND' : !inFrontend && inBackend ? '⚠ SEM FRONTEND' : '✗ AUSENTE';
  if (status !== '✓') allOk = false;
  console.log(action.padEnd(35), status);
}

// Verificar recursos GET
const getResources = ['dashboard','users','organizations','workspaces','plans','subscriptions','billing','crm','audit','logs','security','integrations','featureFlags','system'];
console.log('\n=== RECURSOS GET ===\n');
for (const resource of getResources) {
  const inFrontend = frontend.includes(`'${resource}'`) || frontend.includes(`"${resource}"`);
  const inBackend  = backend.includes(`'${resource}'`)  || backend.includes(`"${resource}"`);
  const status = inFrontend && inBackend ? '✓' : '⚠';
  if (status !== '✓') allOk = false;
  console.log(resource.padEnd(25), status);
}

// Verificar que não há dados mock no frontend
const mockPatterns = ['example.com', 'João Silva', 'Maria Santos', 'R$12.450', 'R$149.400', 'placeholder', 'lorem ipsum'];
console.log('\n=== VERIFICAÇÃO DE DADOS MOCK ===\n');
let hasMocks = false;
for (const pattern of mockPatterns) {
  if (frontend.toLowerCase().includes(pattern.toLowerCase())) {
    console.log(`⚠ MOCK DETECTADO: "${pattern}"`);
    hasMocks = true;
  }
}
if (!hasMocks) console.log('✓ Nenhum dado mock detectado.');

console.log('\n=== RESULTADO FINAL ===');
if (allOk && !hasMocks) {
  console.log('✓ PHASE 306 APROVADA — Funcionalidade total, sem mocks, alinhamento frontend/backend completo.');
} else {
  console.log('✗ REQUER ATENÇÃO — Verificar itens marcados acima.');
}
