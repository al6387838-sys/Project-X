// LifeOS Enterprise — Production Build Script
// Target: Cloudflare Pages
// Version: 11.2.0 (Phases 101-119 — Enterprise Core e Onboarding)

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
  minifyJS: {
    format: { ascii_only: true },
  },
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
  'precision_graphite.css',
  'precision_graphite.js',
  'vendor/lucide.min.js',
  'black_diamond.css',
  'black_diamond.js',
  'design_system/variables.css',
  'design_system/enterprise_identity.css',
  'design_system/enterprise_components.css',
  'design_system/enterprise_v4.css',
  'design_system/enterprise_v9_5.css',
  'design_system/enterprise_v10_1.css',
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

// ─── Copiar módulos HTML v9.2 ────────────────────────────────────────────────
await copy('modules/finance.html', 'modules/finance.html');
await copy('modules/communication.html', 'modules/communication.html');
await copy('modules/email.html', 'modules/email.html');
await copy('modules/calendar.html', 'modules/calendar.html');
await copy('modules/ai-center.html', 'modules/ai-center.html');
await copy('modules/documents.html', 'modules/documents.html');
await copy('modules/productivity.html', 'modules/productivity.html');
await copy('modules/marketplace.html', 'modules/marketplace.html');

// ─── Copiar módulos HTML v9.5 (Phase 081-084) ────────────────────────────────
await copy('modules/app-ecosystem.html', 'modules/app-ecosystem.html');
await copy('modules/personal-hub.html', 'modules/personal-hub.html');
await copy('modules/enterprise-settings.html', 'modules/enterprise-settings.html');
await copy('modules/observability.html', 'modules/observability.html');

// ─── Copiar módulos HTML v10 (Phases 093-097) ───────────────────────────────
await copy('modules/dashboard-v2.html', 'modules/dashboard-v2.html');
await copy('modules/smart-search.html', 'modules/smart-search.html');
await copy('modules/notification-center.html', 'modules/notification-center.html');
await copy('modules/integration-center.html', 'modules/integration-center.html');

// ─── Copiar módulos HTML v10.1 (Phases 101-108) ─────────────────────────────
await copy('modules/life-hub.html', 'modules/life-hub.html');
await copy('modules/integration-marketplace.html', 'modules/integration-marketplace.html');
await copy('modules/ai-copilot.html', 'modules/ai-copilot.html');
await copy('modules/enterprise-admin.html', 'modules/enterprise-admin.html');

// ─── Copiar módulos HTML v10.6 (Phase 109) ──────────────────────────────────
await copy('modules/integrations-manager.html', 'modules/integrations-manager.html');

// ─── Copiar módulos HTML v11 (Phases 111-115) ─────────────────────────────
await copy('modules/dashboard-v11.html', 'modules/dashboard-v11.html');
await copy('modules/identity.html', 'modules/identity.html');
await copy('modules/file-center.html', 'modules/file-center.html');
await copy('modules/automation.html', 'modules/automation.html');
await copy('modules/analytics.html', 'modules/analytics.html');
await copy('services/oauth-manager.js', 'services/oauth-manager.js');

// ─── Rotas principais v10.6 ──────────────────────────────────────────────────
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

// ─── Módulos — carregados dinamicamente pelo app dashboard ───────────────────
await cp(resolve(source, 'modules'), resolve(dist, 'app/modules'), { recursive: true });

// ─── Arquivos públicos, _redirects e _headers ────────────────────────────────
for (const publicFile of ['_headers', 'robots.txt', 'sitemap.xml']) {
  try {
    await cp(resolve(publicDir, publicFile), resolve(dist, publicFile));
  } catch { /* arquivo público opcional */ }
}

// Gerar _redirects v10.6 com rotas preservadas
const redirects = [
  '# LifeOS Enterprise v11.2.0 — Cloudflare Pages Redirects',
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
  '# v10.1 module routes',
  '/life-hub           /app/index.html             200',
  '/ai-copilot         /app/index.html             200',
  '/marketplace        /app/index.html             200',
  '',
  '# v10.6 integration routes',
  '',
  '# v11 module routes',
  '/command-center   /app/index.html             200',
  '/identity         /app/index.html             200',
  '/file-center      /app/index.html             200',
  '/automation       /app/index.html             200',
  '/analytics        /app/index.html             200',
  '/integrations       /app/index.html             200',
  '/integrations/*     /app/index.html             200',
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

// ─── Build metadata v10.6 ────────────────────────────────────────────────────
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const builtAt = new Date().toISOString();
const buildId = `lifeos-v11.2.0-${commit.slice(0, 12)}`;

const routes = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/app',
  '/admin',
  '/enterprise',
  '/memory-center',
  '/life-hub',
  '/ai-copilot',
  '/marketplace',
  '/integrations',
  '/dashboard',
  '/companion',
  '/missions',
  '/timeline',
  '/lifegraph',
  '/briefing',
  '/analytics',
  '/profile',
  '/settings',
];

await writeFile(resolve(dist, 'build-meta.json'), JSON.stringify({
  application: 'LifeOS Enterprise',
  service: 'lifeos-enterprise',
  version: '11.2.0',
  buildId,
  environment: 'production',
  platform: 'cloudflare-pages',
  architecture: 'multi-page-rbac-modules-oauth2-integration-ready',
  phases: [
    '093-CommandCenter','094-UniversalSearch','095-IntegrationCenter','096-CompanionAI',
    '097-EnterpriseAdmin','098-Hardening','099-ReleaseCandidate','100-ProductionRelease',
    '101-ProductPolish','102-LifeHub','103-IntegrationMarketplace','104-AICopilot',
    '105-EnterpriseAdmin','106-QA','107-Build','108-Release','109-IntegrationReadiness','111-UniversalCommandCenter','112-DigitalIdentity','113-EnterpriseFileCenter','114-AutomationStudio','115-AnalyticsCenter','119-EnterpriseOnboarding'
  ],
  modules: [
    'finance','communication','email','calendar','ai-center',
    'documents','productivity','marketplace',
    'app-ecosystem','personal-hub','enterprise-settings','observability',
    'dashboard-v2','smart-search','notification-center','integration-center',
    'life-hub','integration-marketplace','ai-copilot','enterprise-admin',
    'integrations-manager','dashboard-v11','identity','file-center','automation','analytics'
  ],
  commit,
  builtAt,
  routes,
}, null, 2) + '\n');

await writeFile(resolve(dist, 'health.json'), JSON.stringify({
  ok: true,
  service: 'lifeos-enterprise',
  version: '11.2.0',
  buildId,
  environment: 'production',
  platform: 'cloudflare-pages',
  commit,
  builtAt,
}, null, 2) + '\n');

// ─── Validação do build ────────────────────────────────────────────────────────
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

// Validar módulos v9.5
const v95Modules = [
  'app/modules/app-ecosystem.html',
  'app/modules/personal-hub.html',
  'app/modules/enterprise-settings.html',
  'app/modules/observability.html',
];
for (const mod of v95Modules) {
  await stat(resolve(dist, mod));
}

// Validar módulos v10
const v10Modules = [
  'app/modules/dashboard-v2.html',
  'app/modules/smart-search.html',
  'app/modules/notification-center.html',
  'app/modules/integration-center.html',
];
for (const mod of v10Modules) {
  await stat(resolve(dist, mod));
}

// Validar módulos v10.1 (Phases 101-108)
const v101Modules = [
  'app/modules/life-hub.html',
  'app/modules/integration-marketplace.html',
  'app/modules/ai-copilot.html',
  'app/modules/enterprise-admin.html',
];
for (const mod of v101Modules) {
  await stat(resolve(dist, mod));
}

// Validar módulos v10.6 (Phase 109)
const v106Modules = [
  'app/modules/integrations-manager.html',
  'services/oauth-manager.js',
];
for (const mod of v106Modules) {
  await stat(resolve(dist, mod));
}

// ─── Patch URLs legadas ────────────────────────────────────────────────────────
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
  'services/oauth-manager.js',
];
for (const file of [...htmlFiles, ...jsFiles]) {
  await patchApiUrls(resolve(dist, file));
}

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║   LifeOS Enterprise v11.2.0 — Build OK ✓               ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`  Platform      : Cloudflare Pages`);
console.log(`  Version       : 11.2.0`);
console.log(`  Build ID      : ${buildId}`);
console.log(`  Architecture  : Multi-Page RBAC + OAuth 2.0 + Integration Ready`);
console.log(`  Phases        : 101-109 Enterprise Foundation | 111-115 v11 Core | 119 Enterprise Onboarding`);
console.log(`  Modules       : 26 total (8 legacy + 4 v9.5 + 4 v10 + 4 v10.1 + 1 v10.6 + 5 v11)`);
console.log(`  Commit        : ${commit}`);
console.log(`  Built at      : ${builtAt}`);
console.log(`  Routes        : ${routes.length}`);
console.log(`  Assets        : ${required.length}`);
console.log(`  Output        : ${dist}`);
console.log('');
console.log('  Routes:');
routes.forEach(r => console.log(`    ${r}`));
console.log('');
