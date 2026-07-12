import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'premium_ui');
const dist = resolve(root, 'dist');

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
  'animations/animations.css',
  'components/components.css',
  'themes/themes.css',
  'beta/beta-manager.js',
  'beta/analytics-engine.js',
  'beta/feedback-center.js',
  'beta/feature-flags.js',
  'enterprise/enterprise_app.css',
  'enterprise/enterprise_app.js',
];

await copy('index.html');
await copy('login.html', 'login/index.html');
await copy('beta/admin-dashboard.html', 'admin/index.html');
await copy('enterprise/enterprise_premium.html', 'enterprise/index.html');
await copy('memory_center.html', 'memory-center/index.html');
await Promise.all(productionAssets.map((asset) => copy(asset)));

const spaRoutes = ['dashboard', 'companion', 'missions', 'timeline', 'lifegraph', 'briefing', 'analytics', 'profile', 'settings'];
const redirects = [
  '/login /login/index.html 200',
  '/admin /admin/index.html 200',
  '/enterprise /enterprise/index.html 200',
  '/memory-center /memory-center/index.html 200',
  ...spaRoutes.map((route) => `/${route} /index.html 200`),
  '/* /index.html 404',
].join('\n') + '\n';
await writeFile(resolve(dist, '_redirects'), redirects);

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const builtAt = new Date().toISOString();
const routes = ['/', ...spaRoutes.map((route) => `/${route}`), '/login', '/admin', '/enterprise', '/memory-center'];
const metadata = { application: 'LifeOS Enterprise', version: '2.1.0', environment: 'production', commit, builtAt, routes };
await writeFile(resolve(dist, 'build-meta.json'), JSON.stringify(metadata, null, 2) + '\n');
await writeFile(resolve(dist, 'health.json'), JSON.stringify({ ok: true, service: 'lifeos-enterprise', version: '2.1.0', environment: 'production', commit, builtAt }, null, 2) + '\n');

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

console.log(`LifeOS production build ready: ${dist}`);
console.log(`Commit: ${commit}`);
console.log(`Routes: ${routes.length}`);
console.log(`Production assets: ${required.length}`);
