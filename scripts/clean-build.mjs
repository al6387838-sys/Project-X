import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const generatedPaths = [
  'dist',
  'build',
  '.cache',
  '.tmp',
  '.wrangler',
  'node_modules/.cache',
  'test-results',
  'playwright-report',
  'public/sw.js',
  'premium_ui/sw.js',
];

await Promise.all(generatedPaths.map(async (relativePath) => {
  await rm(resolve(root, relativePath), { recursive: true, force: true });
}));

console.log(`Clean build completed: ${generatedPaths.join(', ')}`);
