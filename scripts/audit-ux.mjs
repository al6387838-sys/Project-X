import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const code = await readFile(resolve(root, 'premium_ui/admin_completion.js'), 'utf8');

const uxElements = [
  // Skeleton Loading
  ['Skeleton Loading',        'la-skeleton'],
  ['Shimmer animation',       'la-shimmer'],
  // Empty States
  ['Empty State component',   'la-empty'],
  ['Empty State icon',        'la-empty-icon'],
  ['Empty State title',       'emptyView('],
  // Error States
  ['Error State',             'errorView('],
  ['Error card styling',      'border-color:#fecdca'],
  // Success States
  ['Toast success',           "'success'"],
  ['Toast error',             "'error'"],
  ['Toast info',              "'info'"],
  // Loading inteligente
  ['Loading state flag',      'state.loading'],
  ['Skeleton on load',        'skeletonView()'],
  // Toasts consistentes
  ['Toast stack',             'la-toast-stack'],
  ['Toast animation',         'la-toast-in'],
  ['Toast close button',      'la-toast-close'],
  // Feedback visual
  ['Button hover',            ':hover:not(:disabled)'],
  ['Button active',           ':active:not(:disabled)'],
  ['Button disabled',         ':disabled'],
  ['Focus visible',           'focus-visible'],
  // Transitions
  ['Transition all',          'transition:all'],
  ['Card hover transition',   'la-metric:hover'],
  // Micro animações
  ['Slide in animation',      'la-slide-in'],
  ['Fade in animation',       'la-fade-in'],
  ['Scale in animation',      'la-scale-in'],
  ['Page animate class',      'la-animate'],
  // Dialog
  ['Dialog backdrop',         'la-dialog-backdrop'],
  ['Dialog scale in',         'la-scale-in'],
  // Responsive
  ['Mobile breakpoint 760px', '760px'],
  ['Mobile breakpoint 480px', '480px'],
  ['Mobile sidebar toggle',   'la-mobile-toggle'],
  // Rollback UX
  ['Rollback toast',          'rollback'],
  ['Undo button',             'Desfazer'],
  // Pagination
  ['Pagination bar',          'la-pagination'],
  ['Pagination controls',     'la-pagination-controls'],
  // Professional messages
  ['Integration ready msg',   'Pronto para ativa'],
  ['No integration msg',      'Nenhuma integra'],
];

console.log('=== AUDITORIA UX ENTERPRISE (PHASE 307) ===\n');
let passed = 0;
let failed = 0;
for (const [label, pattern] of uxElements) {
  const found = code.includes(pattern);
  console.log(label.padEnd(35), found ? '✓' : '✗ AUSENTE');
  if (found) passed++; else failed++;
}

console.log(`\n=== RESULTADO: ${passed}/${uxElements.length} elementos presentes ===`);
if (failed === 0) {
  console.log('✓ PHASE 307 APROVADA — UX Enterprise premium completo.');
} else {
  console.log(`✗ ${failed} elemento(s) ausente(s) — requer atenção.`);
}
