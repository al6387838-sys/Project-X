import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { extname, resolve, relative } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'premium_ui');
const ALLOWED = new Set(['.html', '.js']);
const EXCLUDED = new Set(['vendor/lucide.min.js']);
const SYMBOL = /(?:[\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F000}-\u{1FAFF}]|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?(?:\u200D(?:[\u{1F000}-\u{1FAFF}]|[\u2600-\u27BF])(?:\uFE0F|\uFE0E)?)*|[⌚⏱⏰⌛▶⏸⏹⏭⏮ℹ⌨◈◇◎◬■●○⊞⊟▲▼×←→↑↓✓✔✕✖✗✘⚠]/gu;

const pairs = [
  ['\u{26A1}', 'zap'], ['\u{1F512}', 'lock-keyhole'], ['\u{1F510}', 'shield-check'], ['\u{1F6E1}', 'shield-check'],
  ['\u{1F441}', 'eye'], ['\u{1F440}', 'eye'], ['\u{1F3AF}', 'target'], ['\u{1F504}', 'refresh-cw'], ['\u{1F501}', 'repeat-2'],
  ['\u{1F4C5}', 'calendar-days'], ['\u{1F5D3}', 'calendar-range'], ['\u{1F9E0}', 'brain'], ['\u{1F4CA}', 'chart-no-axes-combined'],
  ['\u{1F4C8}', 'trending-up'], ['\u{1F4C9}', 'trending-down'], ['\u{1F680}', 'rocket'], ['\u{1F916}', 'bot'],
  ['\u{1F310}', 'globe-2'], ['\u{1F30D}', 'globe-2'], ['\u{1F517}', 'link-2'], ['\u{1F4E7}', 'mail'], ['\u{2709}', 'mail'],
  ['\u{1F4BC}', 'briefcase-business'], ['\u{2705}', 'circle-check'], ['\u{2611}', 'square-check-big'], ['\u{2713}', 'check'], ['\u{2714}', 'check'],
  ['\u{274C}', 'circle-x'], ['\u{2715}', 'x'], ['\u{2716}', 'x'], ['\u{2717}', 'x'], ['\u{2718}', 'x'],
  ['\u{1F4AC}', 'message-square-text'], ['\u{1F4AD}', 'message-circle-more'], ['\u{1F537}', 'diamond'], ['\u{1F34E}', 'heart-pulse'],
  ['\u{231A}', 'watch'], ['\u{1F4B0}', 'wallet-cards'], ['\u{1F4B3}', 'credit-card'], ['\u{1F419}', 'github'], ['\u{1F4C1}', 'folder'],
  ['\u{1F4C2}', 'folder-open'], ['\u{1F4C4}', 'file-text'], ['\u{1F4D6}', 'book-open'], ['\u{1F4DD}', 'notebook-pen'], ['\u{270F}', 'pencil'],
  ['\u{1F5D1}', 'trash-2'], ['\u{1F511}', 'key-round'], ['\u{1F4F1}', 'smartphone'], ['\u{1F4CB}', 'clipboard-list'],
  ['\u{1F4E4}', 'upload'], ['\u{1F4E5}', 'download'], ['\u{1F6AA}', 'log-out'], ['\u{1F514}', 'bell'], ['\u{1F515}', 'bell-off'],
  ['\u{1F50D}', 'search'], ['\u{1F50E}', 'search'], ['\u{2699}', 'settings'], ['\u{1F6E0}', 'wrench'], ['\u{1F9E9}', 'blocks'],
  ['\u{1F3E2}', 'building-2'], ['\u{1F3EC}', 'building'], ['\u{1F464}', 'user-round'], ['\u{1F465}', 'users-round'],
  ['\u{1F44B}', 'hand'], ['\u{1F4A1}', 'lightbulb'], ['\u{1F525}', 'flame'], ['\u{2B50}', 'star'], ['\u{2605}', 'star'],
  ['\u{2764}', 'heart'], ['\u{1F49C}', 'heart'], ['\u{1F3C6}', 'trophy'], ['\u{1F393}', 'graduation-cap'], ['\u{1F3A8}', 'palette'],
  ['\u{2728}', 'sparkles'], ['\u{1F48E}', 'gem'], ['\u{1F4E6}', 'package'], ['\u{1F6D2}', 'shopping-cart'], ['\u{1F9FE}', 'receipt-text'],
  ['\u{1F4B5}', 'banknote'], ['\u{1F3E6}', 'landmark'], ['\u{1F4E1}', 'radio-tower'], ['\u{2601}', 'cloud'], ['\u{1F50C}', 'plug-zap'],
  ['\u{1F527}', 'wrench'], ['\u{1F9EA}', 'flask-conical'], ['\u{1F9ED}', 'compass'], ['\u{1F5FA}', 'map'], ['\u{1F3E0}', 'house'],
  ['\u{1F4CD}', 'map-pin'], ['\u{23F1}', 'timer'], ['\u{23F0}', 'alarm-clock'], ['\u{231B}', 'hourglass'], ['\u{25B6}', 'play'],
  ['\u{23F8}', 'pause'], ['\u{23F9}', 'square'], ['\u{23ED}', 'skip-forward'], ['\u{23EE}', 'skip-back'], ['\u{2795}', 'plus'],
  ['\u{2796}', 'minus'], ['\u{2190}', 'arrow-left'], ['\u{2192}', 'arrow-right'], ['\u{2191}', 'arrow-up'], ['\u{2193}', 'arrow-down'],
  ['\u{26A0}', 'triangle-alert'], ['\u{2139}', 'info'], ['\u{2753}', 'circle-help'], ['\u{2757}', 'circle-alert'], ['\u{1F6A8}', 'siren'],
  ['\u{1F4BB}', 'laptop'], ['\u{1F5A5}', 'monitor'], ['\u{2328}', 'keyboard'], ['\u{1F5A8}', 'printer'], ['\u{1F399}', 'mic'],
  ['\u{1F3A7}', 'headphones'], ['\u{1F4DE}', 'phone'], ['\u{1F4E2}', 'megaphone'], ['\u{1F50A}', 'volume-2'], ['\u{1F9D8}', 'person-standing'],
  ['\u{1F3C3}', 'activity'], ['\u{1F4AA}', 'dumbbell'], ['\u{1FA7A}', 'stethoscope'], ['\u{1F331}', 'sprout'], ['\u{1F33F}', 'leaf'],
  ['\u{2600}', 'sun'], ['\u{1F319}', 'moon'], ['\u{2615}', 'coffee'], ['\u{1F4CC}', 'pin'], ['\u{1F516}', 'bookmark'],
  ['\u{1F9EE}', 'calculator'], ['\u{1F5C4}', 'archive'], ['\u{1F52C}', 'microscope'], ['\u{1F52D}', 'telescope'], ['\u{1F9EC}', 'dna'],
  ['\u{267B}', 'recycle'], ['\u{1F50B}', 'battery-charging'], ['\u{1F91D}', 'handshake'], ['\u{1F381}', 'gift'], ['\u{1F389}', 'party-popper'],
  ['\u{1F3F7}', 'tag'], ['\u{1F513}', 'unlock'], ['\u{1F50F}', 'file-lock-2'], ['\u{1FAAA}', 'badge-check'], ['\u{1F195}', 'badge-plus'],
  ['○', 'circle'], ['●', 'circle-dot'], ['⊞', 'layout-grid'], ['⊟', 'list'], ['▲', 'triangle'], ['▼', 'chevron-down']
];
const ICONS = new Map(pairs);

function nameFor(token) {
  const plain = token.replace(/[\uFE0E\uFE0F]/g, '');
  return ICONS.get(token) || ICONS.get(plain) || ICONS.get([...plain][0]) || 'circle-dot';
}

function iconMarkup(token) {
  return `<i data-lucide="${nameFor(token)}" class="pg-icon" aria-hidden="true"></i>`;
}

function unicodeEscape(token) {
  return [...token].map((char) => `\\u{${char.codePointAt(0).toString(16).toUpperCase()}}`).join('');
}

function replaceHtmlText(sourceText) {
  let output = '';
  let cursor = 0;
  const protectedPattern = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

  const transformMarkup = (chunk) => {
    let result = '';
    let text = '';
    let inTag = false;
    const flush = () => {
      if (!text) return;
      result += inTag ? text.replace(SYMBOL, '') : text.replace(SYMBOL, iconMarkup);
      text = '';
    };

    for (const char of chunk) {
      if (char === '<' && !inTag) {
        flush();
        inTag = true;
        text = char;
      } else if (char === '>' && inTag) {
        text += char;
        flush();
        inTag = false;
      } else {
        text += char;
      }
    }
    flush();
    return result;
  };

  for (const match of sourceText.matchAll(protectedPattern)) {
    output += transformMarkup(sourceText.slice(cursor, match.index));
    output += match[0].replace(SYMBOL, unicodeEscape);
    cursor = match.index + match[0].length;
  }
  output += transformMarkup(sourceText.slice(cursor));
  const plusIcon = '<i data-lucide="plus" class="pg-icon" aria-hidden="true"></i>';
  output = output
    .replace(/(<(?:button|a|div|span)\b[^>]*>)\s*\+\s+(?=[^<])/gi, `$1${plusIcon} `)
    .replace(/(<div\b[^>]*>)\s*\+\s*(<\/div>)/gi, `$1${plusIcon}$2`);
  return output;
}

async function listFiles(dir) {
  const entries = await readdir(dir);
  const files = [];
  for (const entry of entries) {
    const path = resolve(dir, entry);
    const info = await stat(path);
    if (info.isDirectory()) files.push(...await listFiles(path));
    else files.push(path);
  }
  return files;
}

let changed = 0;
let replacements = 0;
for (const path of await listFiles(source)) {
  const rel = relative(source, path).replaceAll('\\', '/');
  if (!ALLOWED.has(extname(path)) || EXCLUDED.has(rel)) continue;

  const input = await readFile(path, 'utf8');
  const symbolCount = [...input.matchAll(SYMBOL)].length;
  const output = extname(path) === '.html'
    ? replaceHtmlText(input)
    : input.replace(SYMBOL, unicodeEscape);
  if (output === input) continue;

  await writeFile(path, output);
  changed += 1;
  replacements += symbolCount;
  console.log(`${rel}: ${symbolCount} Unicode symbol(s) plus ASCII controls`);
}

console.log(`Updated ${changed} files; migrated ${replacements} visual symbols.`);
