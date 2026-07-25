// Fix: iOS Safari 100vh issue - add CSS custom property fallback
// iOS Safari doesn't account for the address bar in 100vh
// Solution: Use CSS custom property --vh that's set via JavaScript
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { glob } from 'glob';

const root = resolve(import.meta.dirname, '..');

// The fix: add a CSS snippet to variables.css that defines --vh
// and update the app_dashboard.html to set --vh via JS

const variablesCssPath = resolve(root, 'premium_ui/design_system/variables.css');
let variablesCss = await readFile(variablesCssPath, 'utf8');

// Add iOS viewport fix variables if not already present
if (!variablesCss.includes('--vh:')) {
  const iosVhFix = `
/* ── iOS Safari Viewport Fix ──────────────────────────────────────────────── */
/* --vh is set dynamically via JavaScript to account for iOS address bar */
:root {
  --vh: 1vh; /* Fallback — overridden by JS on iOS */
  --app-height: 100vh; /* Fallback */
}
/* Use --app-height for full-screen layouts on iOS */
.app-shell,
.app-sidebar,
.admin-shell,
.auth-page {
  height: calc(var(--vh, 1vh) * 100);
  height: 100dvh; /* Modern browsers */
}
`;
  variablesCss += iosVhFix;
  await writeFile(variablesCssPath, variablesCss);
  console.log('FIXED: variables.css — added iOS viewport fix');
}

// Add the JS fix to app_dashboard.html
const dashboardPath = resolve(root, 'premium_ui/app_dashboard.html');
let dashboard = await readFile(dashboardPath, 'utf8');

const iosVhScript = `
  <!-- iOS Safari viewport height fix -->
  <script>
    (function() {
      function setVH() {
        var vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', vh + 'px');
        document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px');
      }
      setVH();
      window.addEventListener('resize', setVH);
      window.addEventListener('orientationchange', function() {
        setTimeout(setVH, 100);
      });
    })();
  </script>`;

if (!dashboard.includes('iOS Safari viewport height fix')) {
  // Add before </head>
  dashboard = dashboard.replace('</head>', iosVhScript + '\n</head>');
  await writeFile(dashboardPath, dashboard);
  console.log('FIXED: app_dashboard.html — added iOS viewport height fix');
}

// Also fix login_new.html
const loginPath = resolve(root, 'premium_ui/login_new.html');
let login = await readFile(loginPath, 'utf8');

if (!login.includes('iOS Safari viewport height fix')) {
  login = login.replace('</head>', iosVhScript + '\n</head>');
  await writeFile(loginPath, login);
  console.log('FIXED: login_new.html — added iOS viewport height fix');
}

console.log('\nDone: iOS viewport fix applied');
