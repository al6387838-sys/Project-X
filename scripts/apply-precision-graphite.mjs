import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', 'premium_ui');
const files = [
  'landing.html',
  'login_new.html',
  'forgot_password.html',
  'app_dashboard.html',
  'admin_panel.html',
  'memory_center.html',
  'enterprise/enterprise_premium.html',
  'enterprise/executive_dashboard.html',
  'admin/master_admin.html',
];

const assetVersion = '11.2.0';
const stylesheet = `  <link rel="stylesheet" href="/precision_graphite.css?v=${assetVersion}" data-visual-system="precision-graphite" />`;
const script = `  <script src="/precision_graphite.js?v=${assetVersion}" defer data-visual-system="precision-graphite"></script>`;

for (const relative of files) {
  const path = resolve(root, relative);
  let html = await readFile(path, 'utf8');

  if (html.includes('/precision_graphite.css')) {
    html = html.replace(/\s*<link[^>]+href="\/precision_graphite\.css(?:\?v=[^"]+)?"[^>]*>/, `\n${stylesheet}`);
  } else {
    if (!html.includes('</head>')) throw new Error(`Missing </head> in ${relative}`);
    html = html.replace('</head>', `${stylesheet}\n</head>`);
  }

  if (html.includes('/precision_graphite.js')) {
    html = html.replace(/\s*<script[^>]+src="\/precision_graphite\.js(?:\?v=[^"]+)?"[^>]*><\/script>/, `\n${script}`);
  } else {
    if (!html.includes('</body>')) throw new Error(`Missing </body> in ${relative}`);
    html = html.replace('</body>', `${script}\n</body>`);
  }

  await writeFile(path, html);
  console.log(`Precision Graphite linked: ${relative}`);
}
