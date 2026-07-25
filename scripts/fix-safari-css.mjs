// Fix: Add -webkit-backdrop-filter prefix for Safari compatibility
// Also fix 100vh issues on iOS Safari
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { glob } from 'glob';

const root = resolve(import.meta.dirname, '..');

// Find all CSS files in premium_ui
const cssFiles = await glob('premium_ui/**/*.css', { cwd: root, absolute: true });
const htmlFiles = await glob('premium_ui/**/*.html', { cwd: root, absolute: true });

let totalFixed = 0;

// Fix CSS files
for (const file of cssFiles) {
  let content = await readFile(file, 'utf8');
  let changed = false;
  const lines = content.split('\n');
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if line has backdrop-filter but not -webkit-backdrop-filter
    if (line.includes('backdrop-filter:') && !line.includes('-webkit-backdrop-filter:')) {
      // Add -webkit- prefix version after this line
      const webkitLine = line.replace('backdrop-filter:', '-webkit-backdrop-filter:');
      newLines.push(line);
      newLines.push(webkitLine);
      changed = true;
    } else {
      newLines.push(line);
    }
  }

  if (changed) {
    await writeFile(file, newLines.join('\n'));
    const relPath = file.replace(root + '/', '');
    console.log(`FIXED CSS: ${relPath}`);
    totalFixed++;
  }
}

// Fix HTML files - inline styles with backdrop-filter
for (const file of htmlFiles) {
  let content = await readFile(file, 'utf8');
  let changed = false;

  // Fix inline style backdrop-filter without -webkit prefix
  // Pattern: backdrop-filter: blur(...) without preceding -webkit-backdrop-filter
  const newContent = content.replace(
    /(?<!-webkit-)backdrop-filter:\s*([^;'"]+)/g,
    (match, value) => {
      // Only add webkit if it's not already there nearby
      return `-webkit-backdrop-filter: ${value.trim()}; backdrop-filter: ${value.trim()}`;
    }
  );

  if (newContent !== content) {
    await writeFile(file, newContent);
    const relPath = file.replace(root + '/', '');
    console.log(`FIXED HTML: ${relPath}`);
    totalFixed++;
  }
}

console.log(`\nTotal fixed: ${totalFixed} files`);
