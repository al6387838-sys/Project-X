// Fix: Add icon-svg-renderer to all HTML pages that use precision_graphite.js
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const premiumUi = resolve(root, 'premium_ui');

const filesToFix = [
  'app_dashboard.html',
  'login_new.html',
  'forgot_password.html',
  'reset_password.html',
  'confirm_email.html',
  'accept_invite.html',
  'memory_center.html',
];

const RENDERER_SCRIPT = '<script src="/vendor/icon-svg-renderer.js" defer></script>';
const PG_SCRIPT = '<script src="/precision_graphite.js" defer data-visual-system="precision-graphite"></script>';

let fixed = 0;
let skipped = 0;

for (const file of filesToFix) {
  try {
    const path = resolve(premiumUi, file);
    let html = await readFile(path, 'utf8');

    const hasRenderer = html.includes('icon-svg-renderer');
    const hasPG = html.includes('precision_graphite.js');

    if (hasRenderer) {
      console.log(`SKIP (already has renderer): ${file}`);
      skipped++;
      continue;
    }

    if (hasPG) {
      // Add renderer before precision_graphite.js
      html = html.replace(PG_SCRIPT, `${RENDERER_SCRIPT}\n  ${PG_SCRIPT}`);
      await writeFile(path, html);
      console.log(`FIXED: ${file} — added icon-svg-renderer before precision_graphite.js`);
      fixed++;
    } else {
      // Add renderer before </head>
      if (html.includes('</head>')) {
        html = html.replace('</head>', `  ${RENDERER_SCRIPT}\n</head>`);
        await writeFile(path, html);
        console.log(`FIXED: ${file} — added icon-svg-renderer before </head>`);
        fixed++;
      } else {
        console.log(`SKIP (no </head>): ${file}`);
        skipped++;
      }
    }
  } catch (e) {
    console.log(`SKIP (file not found): ${file}`);
    skipped++;
  }
}

console.log(`\nDone: ${fixed} fixed, ${skipped} skipped`);
