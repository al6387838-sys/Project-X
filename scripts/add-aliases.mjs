// Add aliases for icons that don't exist in lucide v0.468
// These map to the closest available icon
import { writeFileSync, readFileSync } from 'fs';

const aliases = {
  'file-presentation': 'file',
  'grid-4x4': 'grid-3x3',
  'brightness': 'sun',
  'saturation': 'droplets',
  'file-kanban': 'file',
  'hard-drive-zap': 'hard-drive',
  'database-restore': 'database-backup',
  'database-search': 'database',
  'rain': 'cloud-rain',
  'speedometer': 'gauge',
  'bicycle': 'compass',
  'stop': 'circle',
  'marker': 'map-pin',
  'bullseye': 'target',
  'screwdriver': 'wrench',
  'hammer-and-wrench': 'wrench',
  'tool': 'pen-tool',
  'distribute-horizontal': 'align-center',
  'distribute-vertical': 'align-center',
  'pulse': 'activity',
  'heartbeat': 'heart-pulse',
  'circle-check-2': 'check-circle',
  'bell-check': 'bell',
  'message-circle-2': 'message-circle',
  'message-square-2': 'message-square',
  'outbox': 'inbox',
  'confetti': 'sparkles',
  'grid-3x3': 'grid-3x3', // already exists
  'circle-alert': 'alert-circle',
  'octagon-alert': 'alert-triangle',
  'alert-octagon': 'alert-triangle',
  'bell-plus': 'bell',
  'bell-minus': 'bell',
  'bell-dot': 'bell',
  'mail-check': 'mail',
  'mail-minus': 'mail',
  'mail-plus': 'mail',
  'mail-question': 'mail',
  'mail-search': 'mail',
  'mail-warning': 'mail',
  'mail-x': 'mail',
  'message-circle-off': 'message-circle',
  'message-square-off': 'message-square',
  'message-square-dot': 'message-square',
  'message-square-more': 'message-circle-more',
  'message-square-reply': 'reply',
  'message-square-x': 'message-square',
  'link-2': 'link',
  'link-2-off': 'link',
  'share-2': 'share',
  'save-all': 'save',
  'plus-square': 'plus-circle',
  'minus-square': 'minus-circle',
  'list-start': 'list-ordered',
  'list-x': 'list',
  'list-todo': 'list',
  'panel-left-close': 'panel-left',
  'panel-left-open': 'panel-left',
  'panel-right-close': 'panel-right',
  'panel-right-open': 'panel-right',
  'align-justify': 'align-center',
  'pound-sterling': 'dollar-sign',
  'indian-rupee': 'dollar-sign',
  'japanese-yen': 'dollar-sign',
  'swiss-franc': 'dollar-sign',
  'euro': 'dollar-sign',
  'receipt-indian-rupee': 'receipt-text',
  'receipt-japanese-yen': 'receipt-text',
  'receipt-pound-sterling': 'receipt-text',
  'receipt-swiss-franc': 'receipt-text',
  'receipt-euro': 'receipt-text',
  'shopping-bag': 'shopping-cart',
  'shopping-basket': 'shopping-cart',
  'package-2': 'package',
  'package-check': 'package',
  'package-minus': 'package',
  'package-plus': 'package',
  'package-search': 'package',
  'package-x': 'package',
  'candy': 'gift',
  'droplets': 'droplet',
  'stars': 'sparkles',
  'bolt': 'zap',
  'flashlight': 'zap',
  'power-off': 'power',
  'plug-zap-2': 'plug-zap',
  'cable-car': 'plug',
  'coffee': 'zap',
  'cup-soda': 'glass',
  'flower': 'sparkles',
  'tree-palm': 'sprout',
  'dumbbell': 'activity',
  'stethoscope': 'heart-pulse',
  'rocket': 'zap',
  'scroll': 'scroll-text',
  'more-horizontal': 'ellipsis',
  'more-vertical': 'ellipsis',
  'dot': 'circle-dot',
  'tags': 'tag',
  'phone-call': 'phone',
  'phone-forwarded': 'phone',
  'phone-incoming': 'phone',
  'phone-missed': 'phone',
  'phone-off': 'phone',
  'phone-outgoing': 'phone',
};

// Load existing map
const svgMap = JSON.parse(readFileSync('/home/ubuntu/Project-X/scripts/icon-svg-map.json', 'utf8'));

for (const [alias, original] of Object.entries(aliases)) {
  if (svgMap[original] && !svgMap[alias]) {
    svgMap[alias] = svgMap[original];
    console.log(`  ${alias} -> ${original}`);
  }
}

writeFileSync('/home/ubuntu/Project-X/scripts/icon-svg-map.json', JSON.stringify(svgMap, null, 2));
console.log(`\n✅ Total icons in map: ${Object.keys(svgMap).length}`);

// Update JS module
let jsCode = '// LifeOS Enterprise — Inline SVG Icon Map\n';
jsCode += '// Auto-generated: DO NOT EDIT\n';
jsCode += `const ICONS = ${JSON.stringify(svgMap, null, 2)};\n`;
jsCode += 'if (typeof module !== "undefined") module.exports = ICONS;\n';
jsCode += 'if (typeof window !== "undefined") window.__LIFEOS_ICONS__ = ICONS;\n';
writeFileSync('/home/ubuntu/Project-X/scripts/icon-svg-map.js', jsCode);
console.log('✅ Updated icon-svg-map.js');
