const m = require('./icon-svg-map.json');
const stillMissing = [
  'tool', 'confetti', 'rain', 'speedometer', 'bicycle', 'stop', 'marker', 'bullseye',
  'screwdriver', 'hammer-and-wrench', 'distribute-horizontal', 'distribute-vertical',
  'pulse', 'heartbeat', 'circle-check-2', 'bell-check', 'message-circle-2', 'message-square-2',
  'outbox', 'bell-plus', 'bell-minus', 'bell-dot',
  'mail-check', 'mail-minus', 'mail-plus', 'mail-question', 'mail-search', 'mail-warning', 'mail-x',
  'message-circle-off', 'message-square-off', 'message-square-dot', 'message-square-more',
  'message-square-reply', 'message-square-x',
  'link-2', 'link-2-off', 'share-2', 'save-all',
  'plus-square', 'minus-square', 'list-start', 'list-x', 'list-todo',
  'panel-left-close', 'panel-left-open', 'panel-right-close', 'panel-right-open',
  'align-justify',
  'pound-sterling', 'indian-rupee', 'japanese-yen', 'swiss-franc', 'euro',
  'receipt-indian-rupee', 'receipt-japanese-yen', 'receipt-pound-sterling', 'receipt-swiss-franc', 'receipt-euro',
  'shopping-bag', 'shopping-basket',
  'package-2', 'package-check', 'package-minus', 'package-plus', 'package-search', 'package-x',
  'candy', 'droplets', 'stars', 'bolt', 'flashlight', 'power-off', 'plug-zap-2', 'cable-car',
  'coffee', 'cup-soda', 'flower', 'tree-palm', 'dumbbell', 'stethoscope', 'rocket', 'scroll',
  'more-horizontal', 'more-vertical', 'dot', 'tags',
  'phone-call', 'phone-forwarded', 'phone-incoming', 'phone-missed', 'phone-off', 'phone-outgoing',
  'grid-3x3', 'circle-alert', 'octagon-alert', 'alert-octagon',
  'file-presentation', 'grid-4x4', 'brightness', 'saturation', 'file-kanban',
  'hard-drive-zap', 'database-restore', 'database-search',
];

const notFound = stillMissing.filter(n => !m[n]);
console.log('Still missing:', notFound);
console.log('Total icons in map:', Object.keys(m).length);
