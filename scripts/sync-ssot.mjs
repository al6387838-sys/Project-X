import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// 1. Load the Single Source of Truth
const config = JSON.parse(readFileSync(resolve(root, 'config/version.json'), 'utf8'));
const VERSION = config.version;
const V_STRING = `v${VERSION}`;

console.log(`╔══════════════════════════════════════════════════════════╗`);
console.log(`║   SSOT SYNC → ${V_STRING.padEnd(31)}║`);
console.log(`╚══════════════════════════════════════════════════════════╝`);

function updateFile(path, patterns) {
  const fullPath = resolve(root, path);
  if (!existsSync(fullPath)) return;
  
  let content = readFileSync(fullPath, 'utf8');
  let changed = false;
  
  for (const [pattern, replacement] of patterns) {
    const newContent = content.replace(pattern, replacement);
    if (newContent !== content) {
      content = newContent;
      changed = true;
    }
  }
  
  if (changed) {
    writeFileSync(fullPath, content);
    console.log(`  ✓ Updated: ${path}`);
  }
}

// 2. Sync package.json
updateFile('package.json', [
  [/"version":\s*"[^"]*"/, `"version": "${VERSION}"`]
]);

// 3. Sync wrangler.toml
updateFile('wrangler.toml', [
  [/LIFEOS_VERSION\s*=\s*"[^"]*"/, `LIFEOS_VERSION = "${V_STRING}"`]
]);

// 4. Sync version.json, build.json, release.json (redundant but kept for legacy compat)
updateFile('version.json', [[/"version":\s*"[^"]*"/, `"version": "${V_STRING}"`]]);
updateFile('build.json', [[/"version":\s*"[^"]*"/, `"version": "${V_STRING}"`]]);
updateFile('release.json', [[/"release":\s*"[^"]*"/, `"release": "${V_STRING}"`]]);

// 5. Sync build script (the source of build-meta.json)
updateFile('scripts/build.mjs', [
  [/Version:\s*[0-9.]+/g, `Version: ${VERSION}`],
  [/LifeOS Enterprise v[0-9.]+/g, `LifeOS Enterprise ${V_STRING}`],
  [/version:\s*'v[0-9.]+'/g, `version: '${V_STRING}'`],
  [/v4[0-9]\.[0-9]\.[0-9]/g, V_STRING]
]);

// 6. Sync Workers / API endpoints
updateFile('functions/api/version.js', [[/version:\s*"[^"]*"/, `version: "${V_STRING}"` ]]);
updateFile('functions/api/health.js', [
  [/version\s*=\s*'[^']*'/, `version = '${V_STRING}'`],
  [/lifeos-[0-9.]+-/, `lifeos-${VERSION}-`]
]);
updateFile('functions/_middleware.js', [[/'x-lifeos-security',\s*'[^']*'/, `'x-lifeos-security', '${V_STRING}'` ]]);

// 7. Sync HTML files (premium_ui source)
const htmlFiles = [
  'premium_ui/index.html',
  'premium_ui/landing.html',
  'premium_ui/login_new.html',
  'premium_ui/admin_panel.html',
  'premium_ui/app_dashboard.html',
  'premium_ui/enterprise/executive_dashboard.html'
];

htmlFiles.forEach(file => {
  updateFile(file, [
    [/LifeOS Enterprise v[0-9.]+/g, `LifeOS Enterprise ${V_STRING}`],
    [/Enterprise v[0-9.]+/g, `Enterprise ${V_STRING}`],
    [/ENTERPRISE v[0-9.]+/g, `ENTERPRISE ${V_STRING}`],
    [/ENTERPRISE UX v[0-9.]+/g, `ENTERPRISE UX ${V_STRING}`],
    [/v4[0-9]\.[0-9]\.[0-9]/g, V_STRING],
    [/\?v=[0-9.]+/g, `?v=${VERSION}`]
  ]);
});

// 8. Sync JS files (premium_ui source)
const jsFiles = [
  'premium_ui/user_completion.js',
  'premium_ui/admin_completion.js',
  'premium_ui/modules/crm-live.js'
];

jsFiles.forEach(file => {
  updateFile(file, [
    [/v4[0-9]\.[0-9]\.[0-9]/g, V_STRING],
    [/v3[0-9]\.[0-9]/g, V_STRING]
  ]);
});

// 9. Sync Modules
const modulesDir = resolve(root, 'premium_ui/modules');
if (existsSync(modulesDir)) {
  const modules = readdirSync(modulesDir).filter(f => f.endsWith('.html'));
  modules.forEach(m => {
    updateFile(`premium_ui/modules/${m}`, [
      [/v4[0-9]\.[0-9]\.[0-9]/g, V_STRING],
      [/v3[0-9]\.[0-9]/g, V_STRING],
      [/CRM ENTERPRISE v[0-9.]+/g, `CRM ENTERPRISE ${V_STRING}`]
    ]);
  });
}

console.log(`\n╔══════════════════════════════════════════════════════════╗`);
console.log(`║   SSOT SYNC COMPLETE: ${V_STRING.padEnd(23)}║`);
console.log(`╚══════════════════════════════════════════════════════════╝`);
