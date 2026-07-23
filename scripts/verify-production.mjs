import { access, readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { currentCommit, loadReleaseConfig } from './release-metadata.mjs';

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
if (!(await exists(dist))) throw new Error('Execute npm run build:clean antes da verificação.');

const requiredFiles = [
  'index.html', 'login/index.html', 'register/index.html', 'forgot-password/index.html',
  'app/index.html', 'admin/index.html', 'enterprise/index.html', 'memory-center/index.html',
  'black_diamond.css', 'black_diamond.js', 'version-display.js', '_redirects', '_headers',
  'robots.txt', 'sitemap.xml', 'release.json', 'build-meta.json', 'health.json',
];
for (const file of requiredFiles) check(`Artefato ${file}`, await exists(resolve(dist, file)));

const sourceRelease = await loadReleaseConfig();
const expectedCommit = currentCommit();
const release = JSON.parse(await readFile(resolve(dist, 'release.json'), 'utf8'));
const metadata = JSON.parse(await readFile(resolve(dist, 'build-meta.json'), 'utf8'));
const health = JSON.parse(await readFile(resolve(dist, 'health.json'), 'utf8'));
const expectedBuildId = `lifeos-${sourceRelease.release.slice(1)}-${expectedCommit.slice(0, 12)}`;

check('Manifesto canônico de release', sourceRelease.release === 'v51.0.0', sourceRelease.release);
check('Release do artefato', release.release === sourceRelease.release, `${release.release} != ${sourceRelease.release}`);
check('Versão espelhada no artefato', release.version === release.release, `${release.version} != ${release.release}`);
check('Commit do artefato', release.commit === expectedCommit, `${release.commit} != ${expectedCommit}`);
check('Build ID determinístico', release.buildId === expectedBuildId, `${release.buildId} != ${expectedBuildId}`);
check('Build-meta usa release único', metadata.release === release.release && metadata.buildId === release.buildId && metadata.commit === release.commit);
check('Health usa release único', health.release === release.release && health.buildId === release.buildId && health.commit === release.commit && health.ok === true);
check('Ambiente de produção', release.environment === 'production' && release.platform === 'cloudflare-pages');
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
const enterprise = await readFile(resolve(dist, 'enterprise/index.html'), 'utf8');
const releaseClient = await readFile(resolve(dist, 'version-display.js'), 'utf8');

check('Landing pública', index.includes('LifeOS') && index.includes('name="viewport"'));
check('Aplicação principal', app.includes('id="page-dashboard"') && app.includes('LifeOS'));
check('Login administrativo', login.includes('/api/login') && login.includes('/api/session'));
check('Sessão administrativa', admin.includes('/api/session') && (admin.includes('/api/logout') || admin.includes('admin_completion.js')));
check('Navegação acessível', app.includes('<nav') && app.includes('aria-label=') && (admin.includes('<nav') || admin.includes('<aside') || admin.includes('admin_completion.js')));
check('Viewport responsivo', app.includes('name="viewport"') && admin.includes('name="viewport"'));
check('Cliente de release na landing', index.includes('/version-display.js') && index.includes('data-lifeos-build') && index.includes('data-lifeos-commit'));
check('Cliente de release no dashboard', app.includes('/version-display.js') && app.includes('data-lifeos-release') && app.includes('data-lifeos-build') && app.includes('data-lifeos-commit'));
check('Cliente de release no admin', admin.includes('/version-display.js') && admin.includes('admin_completion.js'));
check('Limpeza de caches legados', releaseClient.includes('getRegistrations') && releaseClient.includes('caches.delete'));
check('Sem registro de service worker', !releaseClient.includes('serviceWorker.register') && !app.includes('serviceWorker.register'));
check('Sem service worker no artefato', !(await exists(resolve(dist, 'sw.js'))));

const provisionalPattern = /\b(coming soon|dados simulados|placeholder UI)\b/i;
check('Sem fluxos provisórios na aplicação', !provisionalPattern.test(app));
check('Sem fluxos provisórios no Admin Center', !provisionalPattern.test(admin));
check('Sem fluxos provisórios no Enterprise', !provisionalPattern.test(enterprise));

const criticalSources = [
  'scripts/build.mjs', 'scripts/deploy-cloudflare.sh', 'wrangler.toml', 'wrangler.preview.toml',
  'functions/api/version.js', 'functions/api/health.js', 'functions/_middleware.js',
  'premium_ui/app_dashboard.html', 'premium_ui/admin_panel.html',
  'premium_ui/admin_completion.js', 'premium_ui/landing.html', 'public/manifest.webmanifest',
];
const staleReleasePattern = /v(?:4[0-9]|[0-3][0-9])\.\d+\.\d+/;
for (const source of criticalSources) {
  const content = await readFile(resolve(root, source), 'utf8');
  check(`Sem release legado em ${source}`, !staleReleasePattern.test(content));
}

const functionsVersion = await readFile(resolve(root, 'functions/api/version.js'), 'utf8');
const functionsHealth = await readFile(resolve(root, 'functions/api/health.js'), 'utf8');
const releaseReader = await readFile(resolve(root, 'functions/_release.js'), 'utf8');
const wrangler = await readFile(resolve(root, 'wrangler.toml'), 'utf8');
check('API version lê o leitor único', functionsVersion.includes("getReleaseMetadata"));
check('API health lê o leitor único', functionsHealth.includes("getReleaseMetadata"));
check('Leitor usa o asset do release', releaseReader.includes("'/release.json'") && releaseReader.includes('env.ASSETS.fetch'));
check('Sem variável de release no ambiente', !wrangler.includes('LIFEOS_VERSION'));

const files = await walk(dist);
const htmlFiles = files.filter(file => extname(file) === '.html');
for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const links = [...html.matchAll(/(?:href|src)=["']([^"'#?]+)["']/g)].map(match => match[1]);
  for (const link of links) {
    if (link.includes('${')) continue;
    if (/^(?:https?:|data:|mailto:|tel:|javascript:)/.test(link)) continue;
    const target = link.startsWith('/') ? resolve(dist, link.slice(1)) : resolve(file, '..', link);
    const targetExists = await exists(target) || await exists(`${target}.html`) || await exists(resolve(target, 'index.html'));
    const normalizedLink = link.replace(/\/$/, '') || '/';
    const publishedRoute = link.startsWith('/') && metadata.routes.includes(normalizedLink);
    const publishedApi = link.startsWith('/api/') && Array.isArray(metadata.apis) && metadata.apis.includes(normalizedLink);
    check(`Asset ${relative(dist, file)} -> ${link}`, targetExists || publishedRoute || publishedApi);
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
console.log(`Release: ${release.release}`);
console.log(`Build ID: ${release.buildId}`);
console.log(`Commit: ${release.commit}`);
