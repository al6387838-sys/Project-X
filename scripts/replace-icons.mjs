/**
 * LifeOS Enterprise — Icon Replacement Script
 * Replaces all data-lucide="icon-name" with inline SVG equivalents.
 * 
 * Strategy:
 * 1. For HTML files: replace data-lucide="name" with inline <svg> elements
 * 2. For JS files: replace data-lucide="name" with inline <svg> elements
 * 3. Preserve all CSS classes, aria attributes, and surrounding markup
 */

import { readFileSync, writeFileSync, statSync } from 'fs';
import { glob } from 'glob';
import { resolve } from 'path';

const ICON_MAP = JSON.parse(readFileSync(resolve(process.cwd(), 'scripts/icon-svg-map.json'), 'utf8'));
const FALLBACK = ICON_MAP['circle'] || `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;

// Track stats
const stats = {
  filesProcessed: 0,
  totalReplacements: 0,
  filesWithTemplateIcons: 0,
  templateIconReplacements: 0,
  filesModified: [],
  errors: [],
  missingIcons: new Set(),
};

function replaceStaticIcons(content, filePath) {
  // Pattern 1: data-lucide="icon-name" (static names)
  // Matches: data-lucide="search", data-lucide="bell", etc.
  const staticPattern = /data-lucide="([^"$\{]+)"/g;
  let count = 0;
  const result = content.replace(staticPattern, (match, iconName) => {
    const name = iconName.trim();
    const svg = ICON_MAP[name] || FALLBACK;
    if (!ICON_MAP[name]) {
      stats.missingIcons.add(name);
    }
    count++;
    // Replace with inline SVG, preserving the class structure
    // The icon element was typically: <i data-lucide="name" class="..."></i>
    // We replace the entire <i data-lucide="name"...></i> with the SVG
    return `data-lucide="${name}"`; // placeholder, we'll do full replacement next
  });
  
  // Now do the full replacement: replace <i data-lucide="name" ...> with <svg ...>
  // This handles the common pattern: <i data-lucide="name" class="pg-icon"></i>
  const fullPattern = /<i\s+data-lucide="([^"$\{]+)"([^>]*)><\/i>/gi;
  let fullCount = 0;
  const fullResult = content.replace(fullPattern, (match, iconName, attrs) => {
    const name = iconName.trim();
    const svg = ICON_MAP[name] || FALLBACK;
    if (!ICON_MAP[name]) stats.missingIcons.add(name);
    fullCount++;
    // Preserve class and other attributes
    const svgWithAttrs = svg.replace('<svg ', `<svg ${attrs} `);
    return svgWithAttrs;
  });
  
  stats.totalReplacements += fullCount;
  return { content: fullResult, count: fullCount };
}

function replaceTemplateIcons(content) {
  // Pattern: data-lucide="${expression}" (template literals)
  // These are harder - we need to keep them but add a fallback mechanism
  const templatePattern = /data-lucide="\$\{([^}]+)\}"/g;
  let count = 0;
  
  // We can't easily replace template literals statically, but we can
  // add a runtime SVG renderer that replaces them after DOM load
  const results = [...content.matchAll(templatePattern)];
  count = results.length;
  stats.templateIconReplacements += count;
  
  return count;
}

// Find all files with data-lucide
const files = await glob('**/*.{html,js,jsx,ts,tsx}', {
  ignore: ['node_modules/**', '.git/**', 'vendor/**', 'dist/**', 'scripts/**', '**/*.min.*'],
  absolute: false,
});

const filesWithIcons = files.filter(f => {
  try {
    const content = readFileSync(f, 'utf8');
    return content.includes('data-lucide');
  } catch {
    return false;
  }
});

console.log(`Found ${filesWithIcons.length} files with data-lucide`);
console.log(`Icon map has ${Object.keys(ICON_MAP).length} SVG definitions\n`);

for (const file of filesWithIcons) {
  try {
    const content = readFileSync(file, 'utf8');
    
    // Check if this file has template-based icons
    const hasTemplateIcons = /\$\{.*icon.*\}/.test(content) || /data-lucide="\$\{/.test(content);
    if (hasTemplateIcons) {
      stats.filesWithTemplateIcons++;
    }
    
    // Replace static icons
    const { content: newContent, count } = replaceStaticIcons(content, file);
    
    if (count > 0) {
      writeFileSync(file, newContent, 'utf8');
      stats.filesModified.push(file);
      stats.filesProcessed++;
      console.log(`  ✓ ${file}: ${count} replacements`);
    } else {
      // Still count template icon files
      const templateCount = replaceTemplateIcons(content);
      if (templateCount > 0) {
        stats.filesProcessed++;
        console.log(`  ○ ${file}: ${templateCount} template icons (kept as-is)`);
      }
    }
  } catch (e) {
    stats.errors.push({ file, error: e.message });
  }
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`  Icon Replacement Summary`);
console.log(`${'═'.repeat(60)}`);
console.log(`  Files with icons    : ${filesWithIcons.length}`);
console.log(`  Files processed     : ${stats.filesProcessed}`);
console.log(`  Files modified      : ${stats.filesModified.length}`);
console.log(`  Static replacements : ${stats.totalReplacements}`);
console.log(`  Template icons      : ${stats.templateIconReplacements}`);
console.log(`  Files w/ templates  : ${stats.filesWithTemplateIcons}`);
console.log(`  Errors              : ${stats.errors.length}`);
if (stats.missingIcons.size > 0) {
  console.log(`  Missing SVG defs    : ${stats.missingIcons.size}`);
  console.log(`    ${[...stats.missingIcons].join(', ')}`);
}
console.log(`${'═'.repeat(60)}\n`);

// Save stats
writeFileSync(
  resolve(process.cwd(), 'scripts/icon-replacement-stats.json'),
  JSON.stringify({
    ...stats,
    missingIcons: [...stats.missingIcons],
    filesModified: stats.filesModified,
  }, null, 2)
);
console.log('Stats saved to scripts/icon-replacement-stats.json');
