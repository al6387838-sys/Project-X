// Audit all buttons across all HTML files for dead handlers
import { readFileSync } from 'fs';
import { globSync } from 'glob';

const root = new URL('../', import.meta.url).pathname;
const deadButtons = [];

// 1. Scan all HTML files for buttons with onclick
const htmlFiles = globSync(`${root}premium_ui/**/{*.html,**/*.html}`);
for (const file of htmlFiles) {
  const content = readFileSync(file, 'utf8');
  // Find all onclick="..." in buttons
  const onclickRegex = /onclick="([^"]+)"/g;
  let match;
  while ((match = onclickRegex.exec(content)) !== null) {
    const handler = match[1].trim();
    // Skip simple event.preventDefault, closeModal, etc.
        // Skip false positives: event delegation, modal backdrop, simple DOM ops
    if (handler.includes('preventDefault') || handler.includes('stopPropagation') ||
        handler.includes('event.target===this') || handler.includes('.closest(') ||
        handler.includes('location.reload') || handler.includes('.remove()') ||
        handler.includes('this.close')) continue;
    // Extract function name
    const fnMatch = handler.match(/(\w+)\(/);
    if (!fnMatch) continue;
    const fnName = fnMatch[1];
    // Skip built-in and common patterns
    if (['closeModal', 'if', 'event', 'this', 'confirm', 'alert', 'prompt', 'open',
         'console', 'document', 'window'].includes(fnName)) continue;
    // Check if function exists in any JS or HTML file
    let found = false;
    const allCodeFiles = [...htmlFiles, ...globSync(`${root}premium_ui/**/{*.js,**/*.js}`)];
    for (const codeFile of allCodeFiles) {
      const code = readFileSync(codeFile, 'utf8');
      if (code.includes(`function ${fnName}`) || code.includes(`window.${fnName}`) || 
          code.includes(`async function ${fnName}`) || code.includes(`${fnName} =`) ||
          code.includes(`${fnName}(`) ) {
        found = true;
        break;
      }
    }
    if (!found) {
      deadButtons.push({ file: file.replace(root, ''), handler, fnName });
    }
  }
}

if (deadButtons.length > 0) {
  console.log('DEAD BUTTONS FOUND:');
  deadButtons.forEach(b => console.log(`  ${b.file}: ${b.handler} -> ${b.fnName}`));
} else {
  console.log('NO DEAD BUTTONS FOUND - ALL CLEAN');
}

// 2. Check for TODO/FIXME/placeholder patterns
console.log('\n=== TODO/FIXME/PATTERN CHECK ===');
const allFiles = globSync(`${root}premium_ui/**/{*.html,**/*.html,*.js,**/*.js}`);
const patternRegex = /(TODO|FIXME|placeholder|HACK|TEMP)/i;
for (const file of allFiles) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (patternRegex.test(lines[i]) && !lines[i].includes('placeholder="')) {
      console.log(`  ${file.replace(root, '')}:${i+1}: ${lines[i].trim().substring(0, 100)}`);
    }
  }
}

console.log('\nDone.');
