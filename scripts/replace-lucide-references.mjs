/**
 * Replace all lucide.createIcons() calls with window.refreshIcons()
 * across all HTML and JS files.
 */
import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import { resolve } from 'path';

const patterns = [
  { regex: /window\.lucide\?\.createIcons\?\(\)/g, replacement: 'window.refreshIcons?.()' },
  { regex: /window\.lucide\?\.createIcons\(\)/g, replacement: 'window.refreshIcons?.()' },
  { regex: /window\.lucide\.createIcons\(\)/g, replacement: 'window.refreshIcons()' },
  { regex: /lucide\.createIcons\(\)/g, replacement: 'window.refreshIcons?.()' },
  { regex: /if\s*\(\s*window\.lucide\s*\)\s*window\.lucide\.createIcons\(\)/g, replacement: 'window.refreshIcons?.()' },
  { regex: /if\s*\(\s*window\.lucide\s*\)\s*lucide\.createIcons\(\)/g, replacement: 'window.refreshIcons?.()' },
  { regex: /if\s*\(\s*window\.lucide\s*\)\s*lucide\.createIcons\(\)/g, replacement: 'window.refreshIcons?.()' },
  { regex: /if\s*\(window\.lucide\)lucide\.createIcons\(\)/g, replacement: 'window.refreshIcons?.()' },
  { regex: /if\s*\(\s*typeof\s+lucide\s+!==\s+['"]undefined['"]\s*\)\s+lucide\.createIcons\(\)/g, replacement: 'window.refreshIcons?.()' },
  { regex: /if\s*\(\s*typeof\s+lucide\s+!==\s+['"]undefined['"]\s*\)\s+window\.lucide\.createIcons\(\)/g, replacement: 'window.refreshIcons?.()' },
  { regex: /try\s*\{\s*window\.lucide\?\.createIcons\?\(\)\s*;\s*\}\s*catch\s*\(_\)\s*\{\}/g, replacement: 'try { window.refreshIcons?.(); } catch (_) {}' },
  { regex: /if\s*\(\s*window\.lucide\?\.createIcons\s*\)\s*window\.lucide\.createIcons\(\)/g, replacement: 'window.refreshIcons?.()' },
  { regex: /const\s+refreshIcons\s*=\s*\(\)\s*=>\s*\{\s*try\s*\{\s*window\.lucide\?\.createIcons\?\(\)\s*;\s*\}\s*catch\s*\(_\)\s*\{\}\s*\}/g, replacement: 'const refreshIcons = () => { try { window.refreshIcons?.(); } catch (_) {} }' },
];

const files = await glob('premium_ui/**/*.{html,js}', {
  ignore: ['node_modules/**', '.git/**', 'vendor/**', 'dist/**'],
});

let totalReplacements = 0;
let filesModified = 0;

for (const file of files) {
  let content = readFileSync(file, 'utf8');
  let changed = false;
  
  for (const { regex, replacement } of patterns) {
    if (regex.test(content)) {
      content = content.replace(regex, replacement);
      regex.lastIndex = 0;
      changed = true;
    }
  }
  
  if (changed) {
    writeFileSync(file, content, 'utf8');
    const count = (content.match(/refreshIcons/g) || []).length;
    filesModified++;
    totalReplacements += count;
    console.log(`  ✓ ${file}`);
  }
}

console.log(`\nTotal files modified: ${filesModified}`);
console.log(`Total replacements: ${totalReplacements}`);
