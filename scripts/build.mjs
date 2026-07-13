// LifeOS Enterprise — Production Build Script
// Target: Cloudflare Pages
// Version: 4.0.0

import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'premium_ui');
const dist = resolve(root, 'dist');
const publicDir = resolve(root, 'public');

const copy = async (from, to = from) => {
  const target = resolve(dist, to);
  await mkdir(dirname(target), { recursive: true });
  await cp(resolve(source, from), target, { recursive: true });
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const productionAssets = [
  'black_diamond.css',
  'black_diamond.js',
  'design_system/variables.css',
  'design_system/enterprise_identity.css',
  'design_system/enterprise_components.css',
  'animations/animations.css',
  'animations/premium_motion.css',
  'components/components.css',
  'components/command_palette.js',
  'themes/themes.css',
  'beta/beta-manager.js',
  'beta/analytics-engine.js',
  'beta/feedback-center.js',
  'beta/feature-flags.js',
  'enterprise/enterprise_app.css',
  'enterprise/enterprise_app.js',
  'enterprise/executive_dashboard.html',
  'admin/master_admin.html',
];

await copy('index.html');
await copy('login.html', 'login/index.html');
await copy('beta/admin-dashboard.html', 'admin/index.html');
await copy('admin/master_admin.html', 'admin/master.html');
await copy('enterprise/enterprise_premium.html', 'enterprise/index.html');
await copy('enterprise/executive_dashboard.html', 'enterprise/executive.html');
await copy('memory_center.html', 'memory-center/index.html');
await Promise.all(productionAssets.map((asset) => copy(asset)));

// Copiar _headers e _redirects do public/ para dist/
try {
  await cp(resolve(publicDir, '_headers'), resolve(dist, '_headers'));
  await cp(resolve(publicDir, '_redirects'), resolve(dist, '_redirects'));
} catch {
  const spaRoutes = ['dashboard', 'companion', 'missions', 'timeline', 'lifegraph', 'briefing', 'analytics', 'profile', 'settings'];
  const redirects = [
    '/login /login/index.html 200',
    '/admin /admin/index.html 200',
    '/enterprise /enterprise/index.html 200',
    '/memory-center /memory-center/index.html 200',
    ...spaRoutes.map((route) => `/${route} /index.html 200`),
    '/* /index.html 200',
  ].join('\n') + '\n';
  await writeFile(resolve(dist, '_redirects'), redirects);
}

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const builtAt = new Date().toISOString();
const spaRoutes = ['dashboard', 'companion', 'missions', 'timeline', 'lifegraph', 'briefing', 'analytics', 'profile', 'settings'];
const routes = ['/', ...spaRoutes.map((route) => `/${route}`), '/login', '/admin', '/enterprise', '/memory-center'];

await writeFile(resolve(dist, 'build-meta.json'), JSON.stringify({
  application: 'LifeOS Enterprise',
  version: '4.0.0',
  environment: 'production',
  platform: 'cloudflare-pages',
  commit,
  builtAt,
  routes,
}, null, 2) + '\n');

await writeFile(resolve(dist, 'health.json'), JSON.stringify({
  ok: true,
  service: 'lifeos-enterprise',
  version: '4.0.0',
  environment: 'production',
  platform: 'cloudflare-pages',
  commit,
  builtAt,
}, null, 2) + '\n');

const required = [
  'index.html',
  'login/index.html',
  'admin/index.html',
  'enterprise/index.html',
  'memory-center/index.html',
  ...productionAssets,
  '_redirects',
];
for (const file of required) await stat(resolve(dist, file));

const index = await readFile(resolve(dist, 'index.html'), 'utf8');
if (!index.includes('LifeOS') || !index.includes('view-dashboard')) {
  throw new Error('Build inválido: aplicação principal incompleta');
}

// Patch URLs de API: Netlify -> Cloudflare
async function patchApiUrls(filePath) {
  try {
    let content = await readFile(filePath, 'utf8');
    const original = content;
    content = content.replace(/\/\.netlify\/functions\/admin-login/g, '/api/admin-login');
    content = content.replace(/\/\.netlify\/functions\/admin-logout/g, '/api/admin-logout');
    content = content.replace(/\/\.netlify\/functions\/admin-session/g, '/api/admin-session');
    content = content.replace(/\/\.netlify\/functions\/enterprise-data/g, '/api/enterprise-data');
    if (content !== original) {
      await writeFile(filePath, content);
      console.log(`  Patched: ${filePath.replace(dist + '/', '')}`);
    }
  } catch { /* ignorar */ }
}

const htmlFiles = ['index.html', 'login/index.html', 'admin/index.html', 'admin/master.html', 'enterprise/index.html', 'enterprise/executive.html', 'memory-center/index.html'];
const jsFiles = ['black_diamond.js', 'enterprise/enterprise_app.js', 'beta/beta-manager.js', 'beta/analytics-engine.js', 'beta/feedback-center.js', 'beta/feature-flags.js', 'components/command_palette.js'];
for (const file of [...htmlFiles, ...jsFiles]) {
  await patchApiUrls(resolve(dist, file));
}

console.log('');
console.log('╔══════════════════════════════════════════════╗');
console.log('║   LifeOS Enterprise — Production Build OK   ║');
console.log('╚══════════════════════════════════════════════╝');
console.log(`  Platform : Cloudflare Pages`);
console.log(`  Version  : 4.0.0`);
console.log(`  Commit   : ${commit}`);
console.log(`  Built at : ${builtAt}`);
console.log(`  Routes   : ${routes.length}`);
console.log(`  Assets   : ${required.length}`);
console.log(`  Output   : ${dist}`);
console.log('');
