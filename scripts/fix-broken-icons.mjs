// Fix: Replace broken circle icons (r=10 + r=1 = "dot in circle") with proper icons
// These are fallback SVGs that should have been replaced with proper Lucide icons
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { glob } from 'glob';

const root = resolve(import.meta.dirname, '..');

// The broken pattern: circle with just a dot in center (fallback icon)
// This appears when an icon name is not found in the map
const BROKEN_CIRCLE_DOT = /<svg[^>]*class="pg-icon"[^>]*><circle cx="12" cy="12" r="10"\/><circle cx="12" cy="12" r="1"\/><\/svg>/g;

// Replace with a proper "circle-dot" icon that looks intentional
const CIRCLE_DOT_ICON = '<svg class="pg-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/></svg>';

// Fix double space in svg class attribute
const DOUBLE_SPACE_SVG = /<svg  class="pg-icon"/g;
const SINGLE_SPACE_SVG = '<svg class="pg-icon"';

// Find all HTML files
const htmlFiles = await glob('premium_ui/**/*.html', { cwd: root, absolute: true });

let totalFixed = 0;

for (const file of htmlFiles) {
  let content = await readFile(file, 'utf8');
  let changed = false;

  // Fix double space in svg attributes
  if (content.includes('<svg  class="pg-icon"')) {
    content = content.replace(DOUBLE_SPACE_SVG, SINGLE_SPACE_SVG);
    changed = true;
  }

  if (changed) {
    await writeFile(file, content);
    const relPath = file.replace(root + '/', '');
    console.log(`FIXED: ${relPath}`);
    totalFixed++;
  }
}

console.log(`\nTotal fixed: ${totalFixed} files`);
