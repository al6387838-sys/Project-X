import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'premium_ui');
const dist = resolve(root, 'dist');

await rm(dist, { recursive: true, force: true });
await cp(source, dist, { recursive: true });
await mkdir(resolve(dist, 'admin'), { recursive: true });
await cp(resolve(source, 'beta/admin-dashboard.html'), resolve(dist, 'admin/index.html'));
await mkdir(resolve(dist, 'login'), { recursive: true });
await cp(resolve(source, 'login.html'), resolve(dist, 'login/index.html'));

const spaRoutes = ['dashboard', 'companion', 'missions', 'timeline', 'lifegraph', 'briefing', 'analytics', 'profile', 'settings'];
const redirects = [
  '/login /login/index.html 200',
  '/admin /admin/index.html 200',
  ...spaRoutes.map((route) => `/${route} /index.html 200`),
  '/* /index.html 404',
].join('\n') + '\n';
await writeFile(resolve(dist, '_redirects'), redirects);

const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const builtAt = new Date().toISOString();
const metadata = { application: 'LifeOS Enterprise', environment: 'production', commit, builtAt, routes: ['/', ...spaRoutes.map((r) => `/${r}`), '/login', '/admin'] };
await writeFile(resolve(dist, 'build-meta.json'), JSON.stringify(metadata, null, 2) + '\n');
await writeFile(resolve(dist, 'health.json'), JSON.stringify({ ok: true, service: 'lifeos-enterprise', environment: 'production', commit, builtAt }, null, 2) + '\n');

const required = ['index.html', 'login/index.html', 'admin/index.html', 'black_diamond.css', 'black_diamond.js', '_redirects'];
for (const file of required) await stat(resolve(dist, file));
const index = await readFile(resolve(dist, 'index.html'), 'utf8');
if (!index.includes('LifeOS') || !index.includes('view-dashboard')) throw new Error('Build inválido: aplicação principal incompleta');
console.log(`LifeOS production build ready: ${dist}`);
console.log(`Commit: ${commit}`);
console.log(`Routes: ${metadata.routes.length}`);
