// LifeOS Enterprise — Production Build Script
// Target: Cloudflare Pages
// Version: 8.0.0 (com módulos independentes)

import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { minify } from 'html-minifier-terser';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'premium_ui');
const dist = resolve(root, 'dist');
const publicDir = resolve(root, 'public');

// Opções de minificação HTML
const MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  minifyJS: true,
  collapseBooleanAttributes: true,
  decodeEntities: false,
};

// Copiar arquivo (sem minificação) para assets binários/CSS/JS
const copy = async (from, to = from) => {
  const target = resolve(dist, to);
  await mkdir(dirname(target), { recursive: true });
  await cp(resolve(source, from), target, { recursive: true });
};

// Copiar e minificar HTML
const copyHtml = async (from, to) => {
  const target = resolve(dist, to);
  await mkdir(dirname(target), { recursive: true });
  const raw = await readFile(resolve(source, from), 'utf8');
  try {
    const minified = await minify(raw, MINIFY_OPTIONS);
    await writeFile(target, minified);
  } catch (_) {
    // Fallback: copiar sem minificar
    await writeFile(target, raw);
  }
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const productionAssets = [
  'black_diamond.css',
  'black_diamond.js',
  'design_system/variables.css',
  'design_system/enterprise_identity.css',
  'design_system/enterprise_components.css',
  'design_system/enterprise_v4.css',
  'design_system/responsive.css',
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

// ─── Rotas principais v8 ───────────────────────────────────────────────────
// Landing Page (/) — minificado
await copyHtml('landing.html', 'index.html');

// Login unificado (/login) — minificado
await copyHtml('login_new.html', 'login/index.html');

// Cadastro (/register) — reutiliza o painel de cadastro da autenticação unificada
await copyHtml('login_new.html', 'register/index.html');

// Recuperação de senha (/forgot-password) — minificado
await copyHtml('forgot_password.html', 'forgot-password/index.html');

// Dashboard do usuário (/app) — minificado
await copyHtml('app_dashboard.html', 'app/index.html');

// Painel admin (/admin) — minificado
await copyHtml('admin_panel.html', 'admin/index.html');

// Rotas legadas (compatibilidade)
await copy('admin/master_admin.html', 'admin/master.html');
await copy('enterprise/enterprise_premium.html', 'enterprise/index.html');
await copy('enterprise/executive_dashboard.html', 'enterprise/executive.html');
await copyHtml('memory_center.html', 'memory-center/index.html');

// Assets de produção
await Promise.all(productionAssets.map((asset) => copy(asset)));

// ─── Módulos v8.0 — carregados dinamicamente pelo app dashboard ───────────
await cp(resolve(source, 'modules'), resolve(dist, 'app/modules'), { recursive: true });

// ─── Arquivos públicos, _redirects e _headers ───────────────────────────────
for (const publicFile of ['_headers', 'robots.txt', 'sitemap.xml']) {
  try {
    await cp(resolve(publicDir, publicFile), resolve(dist, publicFile));
  } catch { /* arquivo público opcional */ }
}

// Gerar _redirects v8 com novas rotas
const redirects = [
  '# LifeOS Enterprise v8.0.0 — Cloudflare Pages Redirects',
  '',
  '# Auth routes',
  '/login              /login/index.html           200',
  '/register           /register/index.html        200',
  '/forgot-password    /forgot-password/index.html 200',
  '',
  '# App routes (autenticado)',
  '/app                /app/index.html             200',
  '/app/*              /app/index.html             200',
  '',
  '# Admin routes (admin only)',
  '/admin              /admin/index.html           200',
  '/admin/*            /admin/index.html           200',
  '',
  '# Legacy routes (compatibilidade)',
  '/enterprise         /enterprise/index.html      200',
  '/memory-center      /memory-center/index.html   200',
  '/dashboard          /app/index.html             200',
  '/companion          /app/index.html             200',
  '/missions           /app/index.html             200',
  '/timeline           /app/index.html             200',
  '/lifegraph          /app/index.html             200',
  '/briefing           /app/index.html             200',
  '/analytics          /app/index.html             200',
  '/profile            /app/index.html             200',
  '/settings           /app/index.html             200',
  '',
  '# SPA fallback — Landing Page',
  '/*                  /index.html                 200',
  '',
].join('\n');

await writeFile(resolve(dist, '_redirects'), redirects);

// ─── Build metadata ────────────────────────────────────────────────────────
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const builtAt = new Date().toISOString();

const routes = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/app',
  '/admin',
  '/enterprise',
  '/memory-center',
];

await writeFile(resolve(dist, 'build-meta.json'), JSON.stringify({
  application: 'LifeOS Enterprise',
  service: 'lifeos-enterprise',
  version: '8.0.0',
  environment: 'production',
  platform: 'cloudflare-pages',
  architecture: 'multi-page-rbac-modules',
  modules: ['finance','communication','email','calendar','ai-center','documents','productivity','marketplace'],
  commit,
  builtAt,
  routes,
}, null, 2) + '\n');

await writeFile(resolve(dist, 'health.json'), JSON.stringify({
  ok: true,
  service: 'lifeos-enterprise',
  version: '8.0.0',
  environment: 'production',
  platform: 'cloudflare-pages',
  commit,
  builtAt,
}, null, 2) + '\n');

// ─── Validação do build ────────────────────────────────────────────────────
const required = [
  'index.html',
  'login/index.html',
  'register/index.html',
  'forgot-password/index.html',
  'app/index.html',
  'admin/index.html',
  '_redirects',
  'robots.txt',
  'sitemap.xml',
];

for (const file of required) {
  await stat(resolve(dist, file));
}

// Validar landing page
const landing = await readFile(resolve(dist, 'index.html'), 'utf8');
if (!landing.includes('LifeOS')) {
  throw new Error('Build inválido: landing page incompleta');
}

// Validar app dashboard
const appDash = await readFile(resolve(dist, 'app/index.html'), 'utf8');
if (!appDash.includes('LifeOS') || !appDash.includes('/api/session')) {
  throw new Error('Build inválido: app dashboard incompleto');
}

// Validar admin panel
const adminPanel = await readFile(resolve(dist, 'admin/index.html'), 'utf8');
if (!adminPanel.includes('Admin') || !adminPanel.includes('/api/session')) {
  throw new Error('Build inválido: admin panel incompleto');
}

// ─── Patch URLs legadas ────────────────────────────────────────────────────
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

const htmlFiles = [
  'index.html',
  'login/index.html',
  'register/index.html',
  'app/index.html',
  'admin/index.html',
  'admin/master.html',
  'enterprise/index.html',
  'enterprise/executive.html',
  'memory-center/index.html',
];
const jsFiles = [
  'black_diamond.js',
  'enterprise/enterprise_app.js',
  'beta/beta-manager.js',
  'beta/analytics-engine.js',
  'beta/feedback-center.js',
  'beta/feature-flags.js',
  'components/command_palette.js',
];
for (const file of [...htmlFiles, ...jsFiles]) {
  await patchApiUrls(resolve(dist, file));
}

console.log('');
console.log('╔══════════════════════════════════════════════════╗');
console.log('║   LifeOS Enterprise v8.0.0 — Build OK ✓         ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log(`  Platform      : Cloudflare Pages`);
console.log(`  Version       : 8.0.0`);
console.log(`  Architecture  : Multi-Page RBAC + 8 Módulos`);
console.log(`  Modules       : Finance | Comm | Email | Calendar | AI | Docs | Prod | Market`);
console.log(`  Commit        : ${commit}`);
console.log(`  Built at      : ${builtAt}`);
console.log(`  Routes        : ${routes.length}`);
console.log(`  Assets        : ${required.length}`);
console.log(`  Output        : ${dist}`);
console.log('');
console.log('  Routes:');
routes.forEach(r => console.log(`    ${r}`));
console.log('');
