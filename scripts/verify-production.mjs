import { access, readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const checks = [];
const failures = [];

function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

check('Diretório dist', await exists(dist));
if (!(await exists(dist))) throw new Error('Execute npm run build antes da verificação.');

const requiredFiles = [
  'index.html', 'login/index.html', 'register/index.html', 'forgot-password/index.html',
  'app/index.html', 'admin/index.html', 'enterprise/index.html', 'memory-center/index.html',
  'black_diamond.css', 'black_diamond.js', '_redirects', '_headers', 'robots.txt',
  'sitemap.xml', 'build-meta.json', 'health.json'
];
for (const file of requiredFiles) check(`Artefato ${file}`, await exists(resolve(dist, file)));

const metadata = JSON.parse(await readFile(resolve(dist, 'build-meta.json'), 'utf8'));
const health = JSON.parse(await readFile(resolve(dist, 'health.json'), 'utf8'));
const currentCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
check('Commit do build', metadata.commit === currentCommit, `${metadata.commit} != ${currentCommit}`);
check('Healthcheck', health.ok === true && health.environment === 'production');
check('Rotas publicadas', Array.isArray(metadata.routes) && metadata.routes.length >= 12, `${metadata.routes?.length || 0} rotas`);

const redirects = await readFile(resolve(dist, '_redirects'), 'utf8');
for (const route of metadata.routes) {
  if (route === '/') continue;
  check(`Rota ${route}`, redirects.includes(`${route} `));
}

const index = await readFile(resolve(dist, 'index.html'), 'utf8');
const app = await readFile(resolve(dist, 'app/index.html'), 'utf8');
const login = await readFile(resolve(dist, 'login/index.html'), 'utf8');
const admin = await readFile(resolve(dist, 'admin/index.html'), 'utf8');
check('Landing pública', index.includes('LifeOS') && index.includes('name="viewport"'));
check('Aplicação principal', app.includes('id="page-dashboard"') && app.includes('LifeOS'));
check('Login administrativo', login.includes('/api/login') && login.includes('/api/session'));
check('Sessão administrativa', admin.includes('/api/session') && admin.includes('/api/logout'));
check('Navegação acessível', app.includes('<nav') && app.includes('aria-label=') && admin.includes('<nav'));
check('Viewport responsivo', app.includes('name="viewport"') && admin.includes('name="viewport"'));

const provisionalPattern = /\b(coming soon|dados simulados|mock(?:s|ado|ada)?|placeholder UI)\b/i;
check('Sem fluxos provisórios na aplicação', !provisionalPattern.test(app));
check('Sem fluxos provisórios no Admin Center', !provisionalPattern.test(admin));

const files = await walk(dist);
const htmlFiles = files.filter(file => extname(file) === '.html');
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const links = [...html.matchAll(/(?:href|src)=["']([^"'#?]+)["']/g)].map(match => match[1]);
  for (const link of links) {
    if (/^(?:https?:|data:|mailto:|tel:|javascript:)/.test(link)) continue;
    const target = link.startsWith('/') ? resolve(dist, link.slice(1)) : resolve(file, '..', link);
    const targetExists = await exists(target) || await exists(`${target}.html`) || await exists(resolve(target, 'index.html'));
    const publishedRoute = link.startsWith('/') && metadata.routes.includes(link.replace(/\/$/, '') || '/');
    check(`Asset ${relative(dist, file)} -> ${link}`, targetExists || publishedRoute);
  }
}

for (const file of files) {
  const info = await stat(file);
  check(`Tamanho ${relative(dist, file)}`, info.size < 2_000_000, `${info.size} bytes`);
}

const passed = checks.filter(item => item.ok).length;
console.log(`LifeOS production verification: ${passed}/${checks.length} checks passed`);
for (const item of checks.filter(item => !item.ok)) console.error(`FAIL ${item.name}${item.detail ? ` — ${item.detail}` : ''}`);
if (failures.length) process.exit(1);
console.log(`Build ID: ${metadata.commit.slice(0, 12)}-${metadata.builtAt.replace(/[-:.TZ]/g, '').slice(0, 14)}`);
