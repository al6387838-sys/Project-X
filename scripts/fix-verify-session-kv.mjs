// LifeOS Enterprise — Correção: verifySession sem KV
// Substitui verifySession(token, secret) por verifySession(token, secret, env.LIFEOS_KV)
// em todos os arquivos de functions/api/ que não passam o KV
// Exclui: _auth.js (definição), arquivos já corrigidos

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const FUNCTIONS_DIR = join(ROOT, 'functions');

// Padrão a substituir: verifySession(token, secret) sem terceiro argumento
// Não deve substituir: verifySession(token, secret, ...) (já tem KV)
const PATTERN = /verifySession\(token,\s*secret\)(?!\s*\))/g;
const REPLACEMENT = 'verifySession(token, secret, env.LIFEOS_KV)';

// Arquivos a excluir da substituição
const EXCLUDE = [
  '_auth.js', // definição da função
];

let fixed = 0;
let skipped = 0;
const fixedFiles = [];

function processDir(dir) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      processDir(fullPath);
    } else if (entry.endsWith('.js') && !EXCLUDE.includes(entry)) {
      const content = readFileSync(fullPath, 'utf-8');
      if (PATTERN.test(content)) {
        PATTERN.lastIndex = 0; // reset regex
        const newContent = content.replace(PATTERN, REPLACEMENT);
        if (newContent !== content) {
          writeFileSync(fullPath, newContent, 'utf-8');
          const relPath = relative(ROOT, fullPath);
          const count = (content.match(PATTERN) || []).length;
          PATTERN.lastIndex = 0;
          fixedFiles.push({ file: relPath, occurrences: count });
          fixed++;
          console.log(`  ✓ ${relPath} (${count} ocorrência${count > 1 ? 's' : ''})`);
        }
      } else {
        PATTERN.lastIndex = 0;
        skipped++;
      }
    }
  }
}

console.log('');
console.log('LifeOS Enterprise — Correção: verifySession sem KV');
console.log('');
processDir(FUNCTIONS_DIR);
console.log('');
console.log(`Arquivos corrigidos: ${fixed}`);
console.log(`Arquivos sem alteração: ${skipped}`);
console.log('');

// Verificar se ainda existem ocorrências
import { execSync } from 'node:child_process';
try {
  const remaining = execSync(`grep -rn "verifySession(token, secret)" ${FUNCTIONS_DIR} --include="*.js" | grep -v "_auth.js" | wc -l`, { encoding: 'utf-8' }).trim();
  console.log(`Ocorrências restantes sem KV: ${remaining}`);
  if (parseInt(remaining) === 0) {
    console.log('✓ Todas as ocorrências foram corrigidas.');
  }
} catch (e) {
  console.log('Não foi possível verificar ocorrências restantes.');
}
