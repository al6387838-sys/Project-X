/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  LifeOS Enterprise — Version Unification Script                ║
 * ║  Unifies ALL version references to v46.0.0                     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const TARGET = '46.0.0';
const TARGET_V = 'v46.0.0';
const NOW = new Date().toISOString();
const COMMIT_SHA = process.env.CF_PAGES_COMMIT_SHA || 'local-dev';

let changes = 0;
let filesModified = [];

function replaceInFile(filePath, replacements) {
  if (!existsSync(filePath)) { console.log(`  SKIP: ${filePath} (not found)`); return; }
  let content = readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [pattern, replacement] of replacements) {
    if (content.includes(pattern)) {
      content = content.replaceAll(pattern, replacement);
      changed = true;
    }
  }
  if (changed) {
    writeFileSync(filePath, content);
    changes++;
    filesModified.push(filePath.replace(root + '/', ''));
    console.log(`  ✓ ${filePath.replace(root + '/')}`);
  }
}

function writeJSON(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  changes++;
  filesModified.push(filePath.replace(root + '/', ''));
  console.log(`  ✓ ${filePath.replace(root + '/')}`);
}

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log(`║   Version Unification → ${TARGET_V}                    ║`);
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

// ═══════════════════════════════════════════════════════════════════
// 1. package.json
// ═══════════════════════════════════════════════════════════════════
console.log('── package.json ──');
replaceInFile(resolve(root, 'package.json'), [
  ['"version": "45.0.0"', `"version": "${TARGET}"`],
]);

// ═══════════════════════════════════════════════════════════════════
// 2. package-lock.json (project version only, not deps)
// ═══════════════════════════════════════════════════════════════════
console.log('── package-lock.json ──');
let lockContent = readFileSync(resolve(root, 'package-lock.json'), 'utf8');
// Only replace the top-level version (first occurrence after "name")
lockContent = lockContent.replace(/"name": "lifeos-enterprise",\s*\n\s*"version": "43\.0\.0"/, `"name": "lifeos-enterprise",\n  "version": "${TARGET}"`);
writeFileSync(resolve(root, 'package-lock.json'), lockContent);
changes++;
filesModified.push('package-lock.json');
console.log(`  ✓ package-lock.json`);

// ═══════════════════════════════════════════════════════════════════
// 3. build.mjs
// ═══════════════════════════════════════════════════════════════════
console.log('── scripts/build.mjs ──');
replaceInFile(resolve(root, 'scripts/build.mjs'), [
  ['Version: 45.0.0 (Phases 306-313 — Zero Mocks, API-Driven, Certificação Enterprise, Release v45.0)', `Version: ${TARGET} (Phases 306-313 — Zero Mocks, API-Driven, Certificação Enterprise, Release v${TARGET})`],
  ['Release v45.0', `Release v${TARGET}`],
  ["'v45.0.0'", `'${TARGET_V}'`],
  ['lifeos-45.0.0', `lifeos-${TARGET}`],
  ['# LifeOS Enterprise v45.0.0', `# LifeOS Enterprise ${TARGET_V}`],
  [`version: '45.0.0'`, `version: '${TARGET_V}'`],
  ["version: '45.0.0'", `version: '${TARGET_V}'`],
  [`\`  Version       : 45.0.0`, `\`  Version       : ${TARGET_V}`],
  [`  Phases        : 306-313 — Zero Mocks, API-Driven, Certificação Enterprise, Release v45.0`, `  Phases        : 306-313 — Zero Mocks, API-Driven, Certificação Enterprise, Release ${TARGET_V}`],
  ["?v=11.2.0", "?v=46.0.0"],
  ["?v=43.0.0", "?v=46.0.0"],
  ["?v=44.0.0", "?v=46.0.0"],
]);

// ═══════════════════════════════════════════════════════════════════
// 4. premium_ui/admin_panel.html
// ═══════════════════════════════════════════════════════════════════
console.log('── premium_ui/admin_panel.html ──');
replaceInFile(resolve(root, 'premium_ui/admin_panel.html'), [
  ['Admin — LifeOS Enterprise v44.0', `Admin — LifeOS Enterprise ${TARGET_V}`],
  ['v44.0', TARGET_V],
  ['v43.0', TARGET_V],
]);

// ═══════════════════════════════════════════════════════════════════
// 5. premium_ui/app_dashboard.html
// ═══════════════════════════════════════════════════════════════════
console.log('── premium_ui/app_dashboard.html ──');
replaceInFile(resolve(root, 'premium_ui/app_dashboard.html'), [
  [`Dashboard — LifeOS Enterprise v45.0.0`, `Dashboard — LifeOS Enterprise ${TARGET_V}`],
  [`ENTERPRISE UX v45.0.0`, `ENTERPRISE UX ${TARGET_V}`],
  [`ENTERPRISE ONBOARDING v45.0.0`, `ENTERPRISE ONBOARDING ${TARGET_V}`],
  [`ENTERPRISE v45.0.0`, `ENTERPRISE ${TARGET_V}`],
  [`Enterprise v45.0.0`, `Enterprise ${TARGET_V}`],
  [`Enterprise Onboarding v45.0.0`, `Enterprise Onboarding ${TARGET_V}`],
  [`?v=43.0.0`, `?v=${TARGET}`],
  [`?v=44.0.0`, `?v=${TARGET}`],
]);

// ═══════════════════════════════════════════════════════════════════
// 6. premium_ui/landing.html
// ═══════════════════════════════════════════════════════════════════
console.log('── premium_ui/landing.html ──');
replaceInFile(resolve(root, 'premium_ui/landing.html'), [
  [`v43.0.0`, TARGET_V],
]);

// ═══════════════════════════════════════════════════════════════════
// 7. premium_ui/login_new.html
// ═══════════════════════════════════════════════════════════════════
console.log('── premium_ui/login_new.html ──');
replaceInFile(resolve(root, 'premium_ui/login_new.html'), [
  [`v32.1`, TARGET_V],
]);

// ═══════════════════════════════════════════════════════════════════
// 8. premium_ui/index.html
// ═══════════════════════════════════════════════════════════════════
console.log('── premium_ui/index.html ──');
replaceInFile(resolve(root, 'premium_ui/index.html'), [
  [`v32.1`, TARGET_V],
]);

// ═══════════════════════════════════════════════════════════════════
// 9. premium_ui/user_completion.js
// ═══════════════════════════════════════════════════════════════════
console.log('── premium_ui/user_completion.js ──');
replaceInFile(resolve(root, 'premium_ui/user_completion.js'), [
  [`LIFEOS ENTERPRISE v43.0`, `LIFEOS ENTERPRISE ${TARGET_V}`],
]);

// ═══════════════════════════════════════════════════════════════════
// 10. premium_ui/admin_completion.js
// ═══════════════════════════════════════════════════════════════════
console.log('── premium_ui/admin_completion.js ──');
replaceInFile(resolve(root, 'premium_ui/admin_completion.js'), [
  [`v44.0`, TARGET_V],
]);

// ═══════════════════════════════════════════════════════════════════
// 11. functions/_middleware.js
// ═══════════════════════════════════════════════════════════════════
console.log('── functions/_middleware.js ──');
replaceInFile(resolve(root, 'functions/_middleware.js'), [
  [`v41.0.0`, TARGET_V],
  [`Global Security Middleware v41.0.0`, `Global Security Middleware ${TARGET_V}`],
]);

// ═══════════════════════════════════════════════════════════════════
// 12. functions/api/version.js
// ═══════════════════════════════════════════════════════════════════
console.log('── functions/api/version.js ──');
replaceInFile(resolve(root, 'functions/api/version.js'), [
  [`v35.0`, TARGET_V],
  [`BUILD-20260718014737`, `BUILD-${NOW.replace(/[-:TZ]/g, '').slice(0, 14)}`],
]);

// ═══════════════════════════════════════════════════════════════════
// 13. functions/api/health.js
// ═══════════════════════════════════════════════════════════════════
console.log('── functions/api/health.js ──');
replaceInFile(resolve(root, 'functions/api/health.js'), [
  [`v43.0`, TARGET_V],
  [`LifeOS Enterprise v43.0`, `LifeOS Enterprise ${TARGET_V}`],
  [`lifeos-43.0.0`, `lifeos-${TARGET}`],
  [`phases: '303-306'`, `phases: '306-313'`],
]);

// ═══════════════════════════════════════════════════════════════════
// 14. version.json
// ═══════════════════════════════════════════════════════════════════
console.log('── version.json ──');
writeJSON(resolve(root, 'version.json'), {
  version: TARGET_V,
  buildDate: NOW,
  channel: 'production',
  commit: COMMIT_SHA,
});

// ═══════════════════════════════════════════════════════════════════
// 15. build.json
// ═══════════════════════════════════════════════════════════════════
console.log('── build.json ──');
writeJSON(resolve(root, 'build.json'), {
  buildId: `BUILD-${NOW.replace(/[-:TZ]/g, '').slice(0, 14)}`,
  version: TARGET_V,
});

// ═══════════════════════════════════════════════════════════════════
// 16. release.json
// ═══════════════════════════════════════════════════════════════════
console.log('── release.json ──');
writeJSON(resolve(root, 'release.json'), {
  release: TARGET_V,
  status: 'official',
  codename: 'Version Unification Release',
  date: NOW,
});

// ═══════════════════════════════════════════════════════════════════
// 17. public/manifest.webmanifest
// ═══════════════════════════════════════════════════════════════════
console.log('── public/manifest.webmanifest ──');
replaceInFile(resolve(root, 'public/manifest.webmanifest'), [
  [`v18.0`, TARGET_V],
]);

// ═══════════════════════════════════════════════════════════════════
// 18. Update HTML version query params in app_dashboard.html
// ═══════════════════════════════════════════════════════════════════
console.log('── HTML version query params ──');
const dashboardPath = resolve(root, 'premium_ui/app_dashboard.html');
let dashHtml = readFileSync(dashboardPath, 'utf8');
dashHtml = dashHtml.replaceAll('?v=43.0.0', `?v=${TARGET}`);
dashHtml = dashHtml.replaceAll('?v=44.0.0', `?v=${TARGET}`);
writeFileSync(dashboardPath, dashHtml);
console.log(`  ✓ Query params updated`);

// ═══════════════════════════════════════════════════════════════════
// 19. Update user_completion.js version in HTMLs
// ═══════════════════════════════════════════════════════════════════
console.log('── User completion script version ──');
const htmlFiles = [
  resolve(root, 'premium_ui/app_dashboard.html'),
  resolve(root, 'premium_ui/admin_panel.html'),
  resolve(root, 'premium_ui/landing.html'),
];
for (const f of htmlFiles) {
  if (existsSync(f)) {
    let html = readFileSync(f, 'utf8');
    if (html.includes('?v=43.0.0') || html.includes('?v=44.0.0') || html.includes('?v=45.0.0')) {
      html = html.replaceAll('?v=43.0.0', `?v=${TARGET}`);
      html = html.replaceAll('?v=44.0.0', `?v=${TARGET}`);
      html = html.replaceAll('?v=45.0.0', `?v=${TARGET}`);
      writeFileSync(f, html);
      console.log(`  ✓ ${f.replace(root + '/')}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════
console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log(`║   Version Unification Complete: ${TARGET_V}              ║`);
console.log(`║   Files modified: ${changes}                              ║`);
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');
filesModified.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
console.log('');
