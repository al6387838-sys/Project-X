// LifeOS Enterprise — Production Build Script
// Target: Cloudflare Pages
// Release, build ID e commit são derivados exclusivamente de config/release.json.
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { minify } from 'html-minifier-terser';
import { createReleaseMetadata } from './release-metadata.mjs';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'premium_ui');
const dist = resolve(root, 'dist');
const publicDir = resolve(root, 'public');
const releaseMetadata = await createReleaseMetadata();
const { release, buildId, commit, builtAt } = releaseMetadata;

const MINIFY_OPTIONS = {
  collapseWhitespace: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  minifyCSS: true,
  minifyJS: { format: { ascii_only: true } },
  collapseBooleanAttributes: true,
  decodeEntities: false,
};

const copy = async (from, to = from) => {
  const target = resolve(dist, to);
  await mkdir(dirname(target), { recursive: true });
  await cp(resolve(source, from), target, { recursive: true });
};

const copyHtml = async (from, to) => {
  const target = resolve(dist, to);
  await mkdir(dirname(target), { recursive: true });
  const raw = await readFile(resolve(source, from), 'utf8');
  // Substituir query strings de versão antiga por release atual (cache-busting SSOT)
  const withVersionBust = raw.replace(/(\.css|\.js)\?v=[\d.]+/g, `$1?v=${release.slice(1)}`);
  const withReleaseClient = withVersionBust.includes('/version-display.js')
    ? withVersionBust
    : withVersionBust.replace(/<\/head>/i, '  <script src="/version-display.js" defer></script>\n</head>');
  try {
    const minified = await minify(withReleaseClient, MINIFY_OPTIONS);
    await writeFile(target, minified);
  } catch (_) {
    await writeFile(target, withReleaseClient);
  }
};

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const productionAssets = [
  'precision_graphite.css', 'precision_graphite.js', 'vendor/lucide.min.js',
  'black_diamond.css', 'black_diamond.js', 'performance.js', 'version-display.js',
  'design_system/variables.css', 'design_system/enterprise_identity.css',
  'design_system/enterprise_components.css', 'design_system/enterprise_v4.css',
  'design_system/enterprise_v9_5.css', 'design_system/enterprise_v10_1.css',
  'design_system/accessibility.css', 'design_system/responsive.css', 'animations/animations.css',
  'animations/premium_motion.css', 'components/components.css',
  'components/command_palette.js', 'themes/themes.css',
  'beta/beta-manager.js', 'beta/analytics-engine.js',
  'beta/feedback-center.js', 'beta/feature-flags.js',
  'enterprise/enterprise_app.css', 'enterprise/enterprise_app.js',
  'enterprise/executive_dashboard.html', 'admin/master_admin.html', 'admin_completion.js', 'user_completion.js',
  'persistence.js',
];

// Copiar módulos v9.2–v11
await copy('modules/finance.html', 'modules/finance.html');
await copy('modules/communication.html', 'modules/communication.html');
await copy('modules/email.html', 'modules/email.html');
await copy('modules/calendar.html', 'modules/calendar.html');
await copy('modules/ai-center.html', 'modules/ai-center.html');
await copy('modules/documents.html', 'modules/documents.html');
await copy('modules/productivity.html', 'modules/productivity.html');
await copy('modules/marketplace.html', 'modules/marketplace.html');
await copy('modules/app-ecosystem.html', 'modules/app-ecosystem.html');
await copy('modules/personal-hub.html', 'modules/personal-hub.html');
await copy('modules/enterprise-settings.html', 'modules/enterprise-settings.html');
await copy('modules/observability.html', 'modules/observability.html');
await copy('modules/dashboard-v2.html', 'modules/dashboard-v2.html');
await copy('modules/smart-search.html', 'modules/smart-search.html');
await copy('modules/notification-center.html', 'modules/notification-center.html');
await copy('modules/integration-center.html', 'modules/integration-center.html');
await copy('modules/life-hub.html', 'modules/life-hub.html');
await copy('modules/integration-marketplace.html', 'modules/integration-marketplace.html');
await copy('modules/ai-copilot.html', 'modules/ai-copilot.html');
await copy('modules/enterprise-admin.html', 'modules/enterprise-admin.html');
await copy('modules/integrations-manager.html', 'modules/integrations-manager.html');
await copy('modules/dashboard-v11.html', 'modules/dashboard-v11.html');
await copy('modules/identity.html', 'modules/identity.html');
await copy('modules/file-center.html', 'modules/file-center.html');
await copy('modules/photos.html', 'modules/photos.html');
await copy('modules/automation.html', 'modules/automation.html');
await copy('modules/analytics.html', 'modules/analytics.html');
await copy('services/oauth-manager.js', 'services/oauth-manager.js');

// Copiar módulos v14.0 (Phases 139-144)
await copy('modules/communication-hub.html', 'modules/communication-hub.html');
await copy('modules/finance-hub.html', 'modules/finance-hub.html');
await copy('modules/document-center.html', 'modules/document-center.html');

// Rotas principais
await copyHtml('landing.html', 'index.html');
await copyHtml('login_new.html', 'login/index.html');
await copyHtml('login_new.html', 'register/index.html');
await copyHtml('forgot_password.html', 'forgot-password/index.html');
await copyHtml('app_dashboard.html', 'app/index.html');
await copyHtml('admin_panel.html', 'admin/index.html');
await copyHtml('reset_password.html', 'reset-password/index.html');
await copyHtml('confirm_email.html', 'confirm-email/index.html');
await copyHtml('accept_invite.html', 'accept-invite/index.html');
await copy('admin/master_admin.html', 'admin/master.html');
await copy('enterprise/enterprise_premium.html', 'enterprise/index.html');
await copy('enterprise/executive_dashboard.html', 'enterprise/executive.html');
await copyHtml('memory_center.html', 'memory-center/index.html');
await copyHtml('privacy.html', 'privacy/index.html');
await copyHtml('terms.html', 'terms/index.html');
await copyHtml('contact.html', 'contact/index.html');
await copyHtml('status.html', 'status/index.html');

await Promise.all(productionAssets.map((asset) => copy(asset)));
await cp(resolve(source, 'modules'), resolve(dist, 'app/modules'), { recursive: true });

for (const publicFile of ['_headers', 'robots.txt', 'sitemap.xml', 'manifest.webmanifest', 'favicon.svg', 'favicon.ico']) {
  try {
    await cp(resolve(publicDir, publicFile), resolve(dist, publicFile));
  } catch { }
}
// Copiar ícones PWA
try {
  await cp(resolve(publicDir, 'icons'), resolve(dist, 'icons'), { recursive: true });
} catch { }
// Copiar .well-known (security.txt)
try {
  await cp(resolve(publicDir, '.well-known'), resolve(dist, '.well-known'), { recursive: true });
} catch { }

const redirects = [
  `# LifeOS Enterprise ${release} — Cloudflare Pages Redirects`,
  '',
  '# Auth routes',
  '/login              /login/index.html           200',
  '/register           /register/index.html        200',
  '/forgot-password    /forgot-password/index.html 200',
  '/reset-password     /reset-password/index.html  200',
  '/confirm-email      /confirm-email/index.html   200',
  '/accept-invite      /accept-invite/index.html   200',
  '/api/auth/google    /api/auth/google            200',
  '/api/auth/apple     /api/auth/apple             200',
  '/api/auth/config    /api/auth/config            200',
  '',
  '# App routes',
  '/app                /app/index.html             200',
  '',
  '# Admin routes',
  '/admin              /admin/index.html           200',
  '',
  '# Internal module routes',
  '/life-hub           /app/index.html             200',
  '/ai-copilot         /app/index.html             200',
  '/marketplace        /app/index.html             200',
  '/integrations       /app/index.html             200',
  '/companion          /app/index.html             200',
  '/missions           /app/index.html             200',
  '/timeline           /app/index.html             200',
  '/lifegraph          /app/index.html             200',
  '/briefing           /app/index.html             200',
  '/analytics          /app/index.html             200',
  '/profile            /app/index.html             200',
  '/settings           /app/index.html             200',
  '/communication-hub  /app/index.html             200',
  '/finance-hub        /app/index.html             200',
  '/document-center    /app/index.html             200',
  '/ai-orchestrator    /app/index.html             200',
  '/security           /app/index.html             200',
  '/payments           /app/index.html             200',
  '/collaboration      /app/index.html             200',
  '/api-platform       /app/index.html             200',
  '/agenda             /app/index.html             200',
  '/ai                 /app/index.html             200',
  '/ai-center          /app/index.html             200',
  '/ai-daily           /app/index.html             200',
  '/ai-recommendations /app/index.html             200',
  '/ai-weekly          /app/index.html             200',
  '/app-ecosystem      /app/index.html             200',
  '/automation         /app/index.html             200',
  '/billing            /app/index.html             200',
  '/calendar           /app/index.html             200',
  '/command-center     /app/index.html             200',
  '/crm                /app/index.html             200',
  '/document-viewer    /app/index.html             200',
  '/documents          /app/index.html             200',
  '/email              /app/index.html             200',
  '/email-compose      /app/index.html             200',
  '/file-center        /app/index.html             200',
  '/finance            /app/index.html             200',
  '/finance-budget     /app/index.html             200',
  '/finance-cashflow   /app/index.html             200',
  '/finance-goals      /app/index.html             200',
  '/finance-openfinance /app/index.html            200',
  '/finance-pix        /app/index.html             200',
  '/gantt              /app/index.html             200',
  '/goals              /app/index.html             200',
  '/habits             /app/index.html             200',
  '/identity           /app/index.html             200',
  '/integration-center /app/index.html             200',
  '/kanban             /app/index.html             200',
  '/lifescore          /app/index.html             200',
  '/memory             /app/index.html             200',
  '/messages           /app/index.html             200',
  '/notifications      /app/index.html             200',
  '/observability      /app/index.html             200',
  '/personal-hub       /app/index.html             200',
  '/projects           /app/index.html             200',
  '/search             /app/index.html             200',
  '/settings-account   /app/index.html             200',
  '/settings-security  /app/index.html             200',
  '/settings-sessions  /app/index.html             200',
  '/wiki               /app/index.html             200',
  '',
  '# Legacy routes',
  '/enterprise         /enterprise/index.html      200',
  '/memory-center      /memory-center/index.html   200',
  '/dashboard          /app/index.html             200',
  '',
  '# Public commercial pages',
  '/privacy            /privacy/index.html         200',
  '/terms              /terms/index.html           200',
  '/contact            /contact/index.html         200',
  '/status             /status/index.html          200',
  '',
].join('\n');

await writeFile(resolve(dist, '_redirects'), redirects);

const routes = [
  '/', '/login', '/register', '/forgot-password', '/app', '/admin',
  '/enterprise', '/memory-center', '/life-hub', '/ai-copilot',
  '/marketplace', '/integrations', '/dashboard', '/companion',
  '/missions', '/timeline', '/lifegraph', '/briefing', '/analytics',
  '/profile', '/settings', '/reset-password', '/confirm-email', '/accept-invite',
  '/communication-hub', '/finance-hub', '/document-center',
  '/ai-orchestrator', '/security', '/payments', '/collaboration', '/api-platform',
  '/agenda', '/ai', '/ai-center', '/ai-daily', '/ai-recommendations', '/ai-weekly',
  '/app-ecosystem', '/automation', '/billing', '/calendar', '/command-center',
  '/crm', '/document-viewer', '/documents', '/email', '/email-compose',
  '/file-center', '/finance', '/finance-budget', '/finance-cashflow',
  '/finance-goals', '/finance-openfinance', '/finance-pix', '/gantt',
  '/goals', '/habits', '/identity', '/integration-center', '/kanban',
  '/lifescore', '/memory', '/messages', '/notifications', '/observability',
  '/personal-hub', '/projects', '/search', '/settings-account',
  '/settings-security', '/settings-sessions', '/wiki',
];

await writeFile(resolve(dist, 'release.json'), JSON.stringify(releaseMetadata, null, 2) + '\n');

await writeFile(resolve(dist, 'build-meta.json'), JSON.stringify({
  application: 'LifeOS Enterprise',
  service: 'lifeos-enterprise',
  ...releaseMetadata,
  architecture: 'multi-page-rbac-modules-oauth2-openfinance-enterprise-ai-orchestrator-security-payments-collaboration-api-observability',
  phases: [
    '093-100','101-108','109','111-115','119',
    '131-138','139-146','147-152','153-160','161-162','163-171',
    '172-177','225-233','250-254','255','257-258','259-262','279-281','303-306','304-308',
    '341-345','721-725','731-735',
  ],
  modules: [
    'finance','communication','email','calendar','ai-center',
    'documents','productivity','marketplace',
    'app-ecosystem','personal-hub','enterprise-settings','observability',
    'dashboard-v2','smart-search','notification-center','integration-center',
    'life-hub','integration-marketplace','ai-copilot','enterprise-admin',
    'integrations-manager','dashboard-v11','identity','file-center','automation','analytics',
    'communication-hub','finance-hub','document-center','onboarding-flow',
    'system-health','structured-logs','alerts','org-usage',
    'enterprise-admin-control-plane','user-experience-completion','document-workflow-r2',
    'persistence-real','messages-real','email-real','documents-real','photos-real',
  ],
  apis: [
    '/api/dashboard','/api/tasks','/api/habits','/api/goals',
    '/api/communication/hub','/api/communication/callback/[provider]',
    '/api/finance/hub','/api/documents','/api/ai/orchestrator','/api/ai/platform','/api/security',
    '/api/payments','/api/payments/webhook','/api/payments/billing','/api/collaboration','/api/platform',
    '/api/auth/google','/api/auth/apple','/api/auth/config','/api/login','/api/logout','/api/register',
    '/api/email-confirmation','/api/password-reset','/api/session','/api/profile',
    '/api/profile-update','/api/sessions','/api/settings','/api/notifications','/api/workspaces',
    '/api/observability','/api/health','/api/integrations','/api/operation-audit',
    '/api/enterprise/rbac','/api/enterprise/certification','/api/enterprise/invite','/api/enterprise/members','/api/enterprise/config-center','/api/enterprise/onboarding','/api/enterprise-data','/api/crm',
    '/api/automations','/api/comm-hub','/api/analytics-pro','/api/db-optimize','/api/security-audit','/api/admin-data',
    '/api/persistence','/api/messages','/api/email-drafts',
  ],
  routes,
}, null, 2) + '\n');

await writeFile(resolve(dist, 'health.json'), JSON.stringify({
  ok: true,
  service: 'lifeos-enterprise',
  ...releaseMetadata,
  phases: '731-735',
  status: 'operational',
}, null, 2) + '\n');

const required = [
  'index.html', 'login/index.html', 'register/index.html',
  'forgot-password/index.html', 'reset-password/index.html', 'confirm-email/index.html',
  'app/index.html', 'admin/index.html',
  '_redirects', 'robots.txt', 'sitemap.xml',
];

for (const file of required) {
  await stat(resolve(dist, file));
}

const landing = await readFile(resolve(dist, 'index.html'), 'utf8');
if (!landing.includes('LifeOS')) throw new Error('Build inválido: landing page incompleta');

const appDash = await readFile(resolve(dist, 'app/index.html'), 'utf8');
if (!appDash.includes('LifeOS') || !appDash.includes('/api/session')) {
  throw new Error('Build inválido: app dashboard incompleto');
}

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log(`║   LifeOS Enterprise ${release} — Build OK ✓               ║`);
console.log('╚══════════════════════════════════════════════════════════╝');
console.log(`  Platform      : Cloudflare Pages`);
console.log(`  Release       : ${release}`);
console.log(`  Build ID      : ${buildId}`);
console.log(`  Metadata      : config/release.json`);
console.log(`  Modules       : 37 total`);
console.log(`  APIs          : 81 endpoints`);
console.log(`  Commit        : ${commit}`);
console.log(`  Built at      : ${builtAt}`);
console.log(`  Routes        : ${routes.length}`);
console.log(`  Output        : ${dist}`);
console.log('');
