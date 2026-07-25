import { icons } from 'lucide';
import { writeFileSync } from 'fs';

// Convert kebab-case to PascalCase for lucide's icon map
const toPascal = (name) => name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');

// Build SVG from lucide's icon data format
// lucide v0.468 uses: ["svg", {attrs}, [[element, {attrs}, [children...]]]]
function buildSvg(iconData) {
  const [tagName, attrs, children] = iconData;
  // Build SVG string
  const width = attrs.width || 24;
  const height = attrs.height || 24;
  const viewBox = attrs.viewBox || `0 0 ${width} ${height}`;
  const strokeWidth = attrs.strokeWidth || 2;
  
  // Build paths from children
  let paths = '';
  for (const child of (children || [])) {
    if (!child || !Array.isArray(child)) continue;
    const [childTag, childAttrs, childChildren] = child;
    if (childTag === 'path') {
      paths += `<path d="${childAttrs.d || ''}"`;
      // Add any additional path attrs
      if (childAttrs.fill && childAttrs.fill !== 'none') paths += ` fill="${childAttrs.fill}"`;
      paths += `/>`;
    }
    // Handle nested elements (like in some icons with circles, etc.)
    if (childTag === 'circle') {
      paths += `<circle cx="${childAttrs.cx || 0}" cy="${childAttrs.cy || 0}" r="${childAttrs.r || 0}"`;
      if (childAttrs.fill && childAttrs.fill !== 'none') paths += ` fill="${childAttrs.fill}"`;
      paths += `/>`;
    }
    if (childTag === 'line') {
      paths += `<line x1="${childAttrs.x1 || 0}" y1="${childAttrs.y1 || 0}" x2="${childAttrs.x2 || 0}" y2="${childAttrs.y2 || 0}"`;
      paths += `/>`;
    }
    if (childTag === 'polyline') {
      paths += `<polyline points="${childAttrs.points || ''}"`;
      paths += `/>`;
    }
    if (childTag === 'polygon') {
      paths += `<polygon points="${childAttrs.points || ''}"`;
      paths += `/>`;
    }
    if (childTag === 'rect') {
      paths += `<rect x="${childAttrs.x || 0}" y="${childAttrs.y || 0}" width="${childAttrs.width || 0}" height="${childAttrs.height || 0}"`;
      if (childAttrs.rx) paths += ` rx="${childAttrs.rx}"`;
      if (childAttrs.fill && childAttrs.fill !== 'none') paths += ` fill="${childAttrs.fill}"`;
      paths += `/>`;
    }
    if (childTag === 'path' && childChildren) {
      for (const sub of childChildren) {
        if (sub && Array.isArray(sub)) {
          const [subTag, subAttrs] = sub;
          if (subTag === 'path') {
            paths += `<path d="${subAttrs.d || ''}"`;
            if (subAttrs.fill && subAttrs.fill !== 'none') paths += ` fill="${subAttrs.fill}"`;
            paths += `/>`;
          }
        }
      }
    }
  }
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

// All unique icon names used in the project (kebab-case)
const iconNames = [
  'activity', 'alarm-clock', 'alert-circle', 'alert-triangle', 'archive', 'archive-restore',
  'arrow-down', 'arrow-down-left', 'arrow-left', 'arrow-right', 'arrow-right-left', 'arrow-up',
  'arrow-up-right', 'badge-plus', 'ban', 'banknote', 'bar-chart', 'bar-chart-2',
  'bell', 'bell-off', 'bell-ring', 'blocks', 'book-open', 'bot', 'brain', 'brain-circuit',
  'briefcase-business', 'bug', 'building', 'building-2', 'calendar', 'calendar-days',
  'calendar-plus', 'calendar-range', 'chart-bar-stacked', 'chart-column', 'chart-no-axes-combined',
  'check', 'check-check', 'check-circle', 'check-circle-2', 'check-square', 'chevron-down',
  'chevron-left', 'chevron-right', 'circle', 'circle-check', 'circle-dot', 'clipboard-list',
  'clock', 'cloud', 'cloud-upload', 'code-2', 'copy', 'cpu', 'credit-card', 'database',
  'diamond', 'dollar-sign', 'download', 'edit', 'ellipsis', 'external-link', 'eye', 'file',
  'file-text', 'files', 'filter', 'flame', 'flask-conical', 'folder', 'folder-input',
  'folder-open', 'folder-plus', 'forward', 'globe', 'graduation-cap', 'handshake', 'hard-drive',
  'heart', 'heart-pulse', 'history', 'house', 'image', 'inbox', 'info', 'kanban', 'key-round',
  'landmark', 'laptop', 'layers', 'layout-dashboard', 'layout-grid', 'lightbulb', 'link',
  'list', 'list-ordered', 'loader', 'loader-2', 'lock-keyhole', 'log-out', 'mail', 'map',
  'megaphone', 'message-circle', 'message-square-plus', 'message-square-text', 'monitor',
  'monitor-smartphone', 'moon', 'network', 'notebook-pen', 'package', 'palette', 'paperclip',
  'pause', 'pencil', 'person-standing', 'phone', 'pie-chart', 'play-circle', 'plug', 'plug-zap',
  'plus', 'plus-circle', 'power', 'presentation', 'radio', 'refresh-cw', 'repeat', 'reply',
  'rocket', 'rotate-ccw', 'rotate-cw', 'save', 'scroll-text', 'search', 'search-x', 'send',
  'server', 'settings', 'share', 'shield', 'shield-alert', 'shield-check', 'siren',
  'sliders-horizontal', 'smartphone', 'sparkles', 'star', 'sun', 'tag', 'target', 'terminal',
  'timer', 'trash', 'trending-up', 'triangle-alert', 'trophy', 'upload', 'user-cog', 'user-minus',
  'user-plus', 'user-round', 'user-round-plus', 'user-x', 'users', 'users-round', 'wallet',
  'wallet-cards', 'watch', 'wrench', 'x', 'zap', 'zoom-in', 'zoom-out',
  'orbit', 'trash-2', 'eye-off', 'menu', 'circle-help', 'circle-alert',
  'compass', 'map-pin', 'sprout', 'leaf', 'gift', 'party-popper',
  'file-lock-2', 'badge-check', 'triangle', 'square',
  'shopping-cart', 'receipt-text',
  'message-circle-more', 'log-in', 'chevron-up', 'home', 'user',
  'lock', 'github', 'twitter', 'facebook', 'instagram', 'linkedin',
  'youtube', 'code', 'git-branch', 'git-commit', 'git-pull-request',
  'git-merge', 'file-code', 'file-json', 'file-image', 'file-video', 'file-audio',
  'file-archive', 'file-spreadsheet', 'file-presentation',
  'message-square', 'message-square-dashed', 'send-horizontal', 'at-sign',
  'bar-chart-3', 'bar-chart-horizontal', 'bar-chart-big', 'bar-chart-horizontal-big',
  'trending-down', 'arrow-down-right', 'arrow-up-left',
  'circle-minus', 'circle-x', 'circle-chevron-down', 'circle-chevron-left',
  'circle-chevron-right', 'circle-chevron-up',
  'layout-list', 'panel-left', 'panel-right', 'panel-bottom', 'sidebar',
  'table', 'columns-2', 'columns-3', 'rows-2', 'rows-3',
  'grid-3x3', 'grid-4x4', 'type', 'bold', 'italic', 'underline',
  'strikethrough', 'align-left', 'align-center', 'align-right',
  'indent', 'outdent', 'list-checks', 'list-minus',
  'image-plus', 'images', 'video', 'film', 'music',
  'mic-off', 'video-off', 'camera', 'camera-off',
  'crop', 'flip-horizontal', 'flip-vertical',
  'contrast', 'brightness', 'saturation',
  'file-search', 'file-x', 'file-warning', 'file-check', 'file-question',
  'file-clock', 'file-down', 'file-up', 'file-input', 'file-output',
  'file-kanban', 'file-bar-chart', 'file-line-chart', 'file-pie-chart',
  'file-stack', 'file-key', 'file-pen', 'file-minus', 'file-digit',
  'file-cog', 'file-heart', 'file-plus', 'folder-search', 'folder-x',
  'folder-check', 'folder-down', 'folder-up', 'folder-minus', 'folder-cog',
  'folder-heart', 'folder-key', 'folder-lock',
  'hard-drive-download', 'hard-drive-upload', 'hard-drive-zap',
  'database-zap', 'database-backup', 'database-restore', 'database-search',
  'server-cog', 'server-crash', 'server-off',
  'unplug', 'cable', 'webhook',
  'shield-x', 'shield-off', 'shield-ban', 'shield-question',
  'key', 'fingerprint', 'scan', 'scan-text', 'scan-face',
  'scan-barcode', 'scan-line', 'nfc', 'wifi', 'wifi-off',
  'bluetooth', 'usb', 'battery', 'battery-low', 'battery-warning',
  'thermometer', 'wind', 'rain', 'snowflake', 'cloud-rain', 'cloud-snow',
  'cloud-lightning', 'cloud-off', 'cloudy', 'cloud-fog',
  'cloud-sun', 'cloud-moon',
  'gauge', 'speedometer', 'fuel', 'car', 'truck', 'bus', 'train',
  'plane', 'ship', 'bicycle',
  'navigation', 'navigation-2', 'navigation-off',
  'globe-2', 'map-pin-off', 'map-pin-plus',
  'route', 'route-off',
  'calendar-check', 'calendar-clock', 'calendar-heart', 'calendar-x', 'calendar-off',
  'calendar-search', 'calendar-cog',
  'clock-1', 'clock-2', 'clock-3', 'clock-4', 'clock-5', 'clock-6',
  'clock-7', 'clock-8', 'clock-9', 'clock-10', 'clock-11', 'clock-12',
  'alarm-clock-off', 'alarm-clock-check',
  'timer-off', 'timer-reset', 'play', 'stop',
  'skip-back', 'skip-forward', 'rewind', 'fast-forward',
  'shuffle', 'repeat-1', 'repeat-2',
  'disc', 'disc-2', 'disc-3',
  'music-2', 'music-3', 'music-4',
  'headphone-off', 'speaker', 'volume-1', 'volume-x',
  'maximize', 'minimize', 'minimize-2', 'maximize-2',
  'move', 'move-3d', 'move-diagonal', 'move-diagonal-2',
  'move-horizontal', 'move-vertical',
  'arrow-big-down', 'arrow-big-left', 'arrow-big-right', 'arrow-big-up',
  'corner-down-left', 'corner-down-right', 'corner-left-down', 'corner-left-up',
  'corner-right-down', 'corner-right-up', 'corner-up-left', 'corner-up-right',
  'undo', 'redo',
  'lock-keyhole-open',
  'user-2', 'user-check', 'user-check-2', 'user-plus-2', 'user-minus-2',
  'user-round-check', 'user-round-cog', 'user-round-x',
  'users-2',
  'hand-metal', 'heart-handshake',
  'smile', 'smile-plus', 'meh', 'frown',
  'sparkle', 'star-half', 'star-off',
  'badge-alert', 'badge-minus',
  'award', 'medal',
  'book-marked', 'book-open-check',
  'notebook', 'notebook-tabs', 'notebook-text',
  'pencil-line', 'pen', 'pen-line',
  'eraser', 'highlighter', 'marker',
  'wand', 'wand-2',
  'gem', 'crown', 'swords',
  'crosshair', 'bullseye',
  'radar',
  'circuit-board',
  'memory-stick', 'monitor-check', 'monitor-cog', 'monitor-speaker', 'monitor-x',
  'laptop-2', 'tablet', 'tablet-smartphone', 'smartphone-nfc', 'smartphone-charging',
  'tv', 'tv-2', 'projector',
  'radio-tower', 'antenna',
  'cloud-cog', 'cloud-download',
  'settings-2',
  'sliders',
  'hammer', 'screwdriver', 'hammer-and-wrench',
  'tool', 'construction',
  'bug-off', 'bug-play',
  'search-check', 'search-code',
  'filter-x', 'list-filter',
  'sort-asc', 'sort-desc',
  'chevrons-up', 'chevrons-down', 'chevrons-left', 'chevrons-right',
  'sidebar-close', 'sidebar-open',
  'table-properties',
  'columns-4', 'rows-4',
  'align-start-horizontal', 'align-start-vertical',
  'align-end-horizontal', 'align-end-vertical',
  'stretch-horizontal', 'stretch-vertical',
  'distribute-horizontal', 'distribute-vertical',
  'clipboard', 'clipboard-check', 'clipboard-copy', 'clipboard-paste', 'clipboard-plus', 'clipboard-x', 'clipboard-type',
  'folder-archive', 'folder-closed', 'folder-git', 'folder-git-2', 'folder-kanban', 'folder-output',
  'folder-pen', 'folder-root', 'folder-search-2', 'folder-symlink', 'folder-tree',
  'archive-x',
  'receipt',
  'bar-chart-4',
  'chart-bar', 'chart-bar-big', 'chart-column-increasing', 'chart-column-stacked',
  'chart-area', 'chart-line', 'chart-pie', 'chart-scatter', 'chart-spline',
  'pulse', 'heartbeat',
  'arrow-left-right',
  'arrow-big-down-dash', 'arrow-big-left-dash', 'arrow-big-right-dash', 'arrow-big-up-dash',
  'refresh-ccw', 'loader-circle',
  'x-circle', 'x-square',
  'circle-check-2', 'circle-plus',
  'square-check', 'square-check-big', 'square-minus', 'square-plus', 'square-x',
  'octagon-alert', 'alert-octagon',
  'bell-dot', 'bell-plus', 'bell-minus', 'bell-check',
  'mail-open', 'mail-check', 'mail-minus', 'mail-plus', 'mail-question', 'mail-search', 'mail-warning', 'mail-x',
  'message-circle-2', 'message-circle-off',
  'message-square-2', 'message-square-dot', 'message-square-more', 'message-square-off',
  'message-square-reply', 'message-square-x',
  'reply-all', 'outbox',
  'link-2', 'link-2-off',
  'share-2',
  'save-all',
  'plus-square', 'minus-square',
  'list-start', 'list-x', 'list-todo',
  'panel-left-close', 'panel-left-open',
  'panel-right-close', 'panel-right-open',
  'align-justify',
  'pound-sterling', 'indian-rupee', 'japanese-yen', 'swiss-franc', 'euro',
  'receipt-indian-rupee', 'receipt-japanese-yen', 'receipt-pound-sterling', 'receipt-swiss-franc', 'receipt-euro',
  'shopping-bag', 'shopping-basket',
  'package-2', 'package-check', 'package-minus', 'package-plus', 'package-search', 'package-x',
  'candy', 'confetti',
  'droplets', 'droplet',
  'stars',
  'bolt', 'flashlight',
  'power-off',
  'plug-zap-2', 'cable-car',
  'car', 'truck', 'bus', 'train', 'plane', 'ship', 'bicycle',
  'coffee', 'cup-soda',
  'flower', 'tree-palm',
  'dumbbell',
  'stethoscope',
  'timer', 'watch',
  'rocket',
  'scroll',
  'more-horizontal', 'more-vertical', 'dot',
  'tags',
  'phone-call', 'phone-forwarded', 'phone-incoming', 'phone-missed', 'phone-off', 'phone-outgoing',
  'minus',
];

const svgMap = {};
const missing = [];

for (const name of iconNames) {
  const pascalName = toPascal(name);
  const iconData = icons[pascalName];
  if (iconData && Array.isArray(iconData)) {
    try {
      svgMap[name] = buildSvg(iconData);
    } catch (e) {
      missing.push(`${name} (${e.message})`);
    }
  } else {
    missing.push(name);
  }
}

writeFileSync('/home/ubuntu/Project-X/scripts/icon-svg-map.json', JSON.stringify(svgMap, null, 2));

console.log(`\n✅ Generated SVG map for ${Object.keys(svgMap).length} icons`);
console.log(`⚠️  Missing icons: ${missing.length}`);
if (missing.length > 0) console.log('   Missing:', missing.join(', '));
console.log(`\n📊 Sample: activity = ${svgMap['activity']?.substring(0, 120)}...`);
console.log(`📊 Sample: check = ${svgMap['check']?.substring(0, 120)}...`);

// Write JS module version
let jsCode = '// LifeOS Enterprise — Inline SVG Icon Map\n';
jsCode += '// Auto-generated: DO NOT EDIT\n';
jsCode += `const ICONS = ${JSON.stringify(svgMap, null, 2)};\n`;
jsCode += 'if (typeof module !== "undefined") module.exports = ICONS;\n';
jsCode += 'if (typeof window !== "undefined") window.__LIFEOS_ICONS__ = ICONS;\n';
writeFileSync('/home/ubuntu/Project-X/scripts/icon-svg-map.js', jsCode);
console.log('✅ Written icon-svg-map.js');
