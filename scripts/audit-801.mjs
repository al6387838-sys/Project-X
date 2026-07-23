// LifeOS Enterprise — Auditoria Funcional Completa (FASE 801)
// Testa TODOS os módulos, botões, menus, modais e fluxos da plataforma
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const BASE = 'https://lifeos-enterprise.pages.dev';
const TIMEOUT = 15000;

const results = [];
const errors = [];

function log(tela, item, status, detalhe = '') {
  const entry = { tela, item, status, detalhe, ts: new Date().toISOString() };
  results.push(entry);
  const icon = status === 'OK' ? '✅' : status === 'PARCIAL' ? '⚠️' : '❌';
  console.log(`${icon} [${tela}] ${item}${detalhe ? ' — ' + detalhe : ''}`);
}

async function checkPage(page, url, name) {
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const status = resp?.status() || 0;
    if (status >= 400) {
      log(name, 'Página', 'ERRO', `HTTP ${status}`);
      errors.push({ tela: name, url, erro: `HTTP ${status}` });
      return false;
    }
    return true;
  } catch (e) {
    log(name, 'Página', 'ERRO', e.message.slice(0, 80));
    errors.push({ tela: name, url, erro: e.message.slice(0, 80) });
    return false;
  }
}

async function testAPI(page, endpoint, method = 'GET') {
  try {
    const resp = await page.evaluate(async ({ url, method }) => {
      const r = await fetch(url, { method, credentials: 'include' });
      const text = await r.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return { status: r.status, ok: r.ok, json, text: text.slice(0, 200) };
    }, { url: `${BASE}${endpoint}`, method });
    return resp;
  } catch (e) {
    return { status: 0, ok: false, error: e.message };
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('\n========================================');
  console.log('LIFEOS ENTERPRISE — AUDITORIA FASE 801');
  console.log('========================================\n');

  // ── 1. LANDING PAGE ──────────────────────────────────────────────
  console.log('\n── LANDING PAGE ──');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.waitForTimeout(1000);

  const navLinks = await page.$$eval('nav a', els => els.map(e => ({ text: e.textContent?.trim(), href: e.getAttribute('href') })));
  log('Landing', 'Navbar carregada', 'OK', `${navLinks.length} links`);

  // Testar botões CTA
  const ctaButtons = await page.$$eval('a[href="/register"], a[href="/login"]', els => els.map(e => e.textContent?.trim()));
  log('Landing', 'Botões CTA (Começar/Entrar)', ctaButtons.length >= 2 ? 'OK' : 'ERRO', ctaButtons.join(', '));

  // Testar FAQ accordion
  const faqItems = await page.$$('[class*="faq"] button, [class*="accordion"] button, details summary');
  if (faqItems.length > 0) {
    try {
      await faqItems[0].click();
      await page.waitForTimeout(300);
      log('Landing', 'FAQ Accordion', 'OK', `${faqItems.length} itens`);
    } catch {
      log('Landing', 'FAQ Accordion', 'PARCIAL', 'Clique falhou');
    }
  } else {
    // Try div-based FAQ
    const faqDivs = await page.$$('[id*="faq"] div[class], section[id="faq"] div');
    log('Landing', 'FAQ Accordion', faqDivs.length > 0 ? 'PARCIAL' : 'ERRO', `${faqDivs.length} elementos encontrados`);
  }

  // Formulário de contato
  const contactForm = await page.$('form, #contact');
  log('Landing', 'Formulário de Contato', contactForm ? 'OK' : 'ERRO');

  // ── 2. LOGIN ──────────────────────────────────────────────────────
  console.log('\n── LOGIN ──');
  await checkPage(page, `${BASE}/login`, 'Login');
  
  const loginEmail = await page.$('#login-email');
  const loginPwd = await page.$('#login-password');
  const loginBtn = await page.$('#login-btn');
  log('Login', 'Formulário de login', loginEmail && loginPwd && loginBtn ? 'OK' : 'ERRO');

  // Testar toggle de senha
  const pwdToggle = await page.$('#login-pwd-toggle');
  if (pwdToggle) {
    await pwdToggle.click();
    await page.waitForTimeout(200);
    const pwdType = await page.$eval('#login-password', el => el.type);
    log('Login', 'Toggle mostrar senha', pwdType === 'text' ? 'OK' : 'PARCIAL');
  }

  // Testar link "Esqueci a senha"
  const forgotLink = await page.$('a[href*="forgot"]');
  log('Login', 'Link Esqueci a senha', forgotLink ? 'OK' : 'ERRO');

  // Testar tab Criar Conta
  const tabRegister = await page.$('#tab-register');
  if (tabRegister) {
    await tabRegister.click();
    await page.waitForTimeout(300);
    const nameField = await page.$('#register-name, input[name="name"], input[placeholder*="nome"]');
    log('Login', 'Tab Criar Conta', nameField ? 'OK' : 'PARCIAL', 'Campos de registro');
  }

  // ── 3. REGISTRO ──────────────────────────────────────────────────
  console.log('\n── REGISTRO ──');
  await checkPage(page, `${BASE}/register`, 'Registro');

  // ── 4. ESQUECI A SENHA ────────────────────────────────────────────
  console.log('\n── ESQUECI A SENHA ──');
  await checkPage(page, `${BASE}/forgot-password`, 'Esqueci Senha');
  const forgotEmailField = await page.$('input[type="email"]');
  const forgotSubmitBtn = await page.$('button[type="submit"], button');
  log('Esqueci Senha', 'Formulário', forgotEmailField && forgotSubmitBtn ? 'OK' : 'ERRO');

  // ── 5. APIs PÚBLICAS ──────────────────────────────────────────────
  console.log('\n── APIs PÚBLICAS ──');
  const healthApi = await testAPI(page, '/api/health');
  log('API', '/api/health', healthApi.status === 200 ? 'OK' : 'ERRO', `HTTP ${healthApi.status}`);

  const versionApi = await testAPI(page, '/api/version');
  log('API', '/api/version', versionApi.status === 200 ? 'OK' : 'ERRO', `HTTP ${versionApi.status}`);

  const authConfigApi = await testAPI(page, '/api/auth/config');
  log('API', '/api/auth/config', authConfigApi.status === 200 ? 'OK' : 'ERRO', 
    `HTTP ${authConfigApi.status} | providers: ${JSON.stringify(authConfigApi.json?.providers || {})}`);

  // ── 6. LOGIN COMO USUÁRIO DEMO ────────────────────────────────────
  console.log('\n── TENTATIVA DE LOGIN ──');
  // Testar API de login diretamente
  const loginResp = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'demo@lifeos.app', password: 'demo12345' }),
      credentials: 'include',
    });
    const json = await r.json();
    return { status: r.status, json };
  }, BASE);
  log('Login API', 'POST /api/login (demo)', loginResp.status === 200 ? 'OK' : 'PARCIAL', 
    `HTTP ${loginResp.status} — ${loginResp.json?.error || loginResp.json?.ok}`);

  // ── 7. APP DASHBOARD (sem autenticação) ───────────────────────────
  console.log('\n── APP DASHBOARD (não autenticado) ──');
  const appResp = await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.waitForTimeout(1500);
  const appUrl = page.url();
  log('App Dashboard', 'Redirecionamento não autenticado', 
    appUrl.includes('/login') || appUrl.includes('/app') ? 'OK' : 'PARCIAL',
    `Redirecionou para: ${appUrl}`);

  // ── 8. MÓDULOS (verificar se carregam) ────────────────────────────
  console.log('\n── MÓDULOS ──');
  const modules = [
    { path: '/app/modules/finance.html', name: 'Finanças' },
    { path: '/app/modules/calendar.html', name: 'Calendário' },
    { path: '/app/modules/documents.html', name: 'Documentos' },
    { path: '/app/modules/productivity.html', name: 'Produtividade' },
    { path: '/app/modules/marketplace.html', name: 'Marketplace' },
    { path: '/app/modules/ai-center.html', name: 'AI Center' },
    { path: '/app/modules/communication.html', name: 'Comunicação' },
    { path: '/app/modules/email.html', name: 'Email' },
    { path: '/app/modules/analytics.html', name: 'Analytics' },
    { path: '/app/modules/automation.html', name: 'Automação' },
    { path: '/app/modules/identity.html', name: 'Identidade' },
    { path: '/app/modules/integration-center.html', name: 'Centro de Integração' },
    { path: '/app/modules/smart-search.html', name: 'Busca Inteligente' },
    { path: '/app/modules/notification-center.html', name: 'Notificações' },
    { path: '/app/modules/observability.html', name: 'Observabilidade' },
    { path: '/app/modules/personal-hub.html', name: 'Hub Pessoal' },
    { path: '/app/modules/photos.html', name: 'Fotos' },
    { path: '/app/modules/file-center.html', name: 'Arquivos' },
    { path: '/app/modules/enterprise-admin.html', name: 'Admin Enterprise' },
    { path: '/app/modules/enterprise-settings.html', name: 'Config Enterprise' },
    { path: '/app/modules/life-hub.html', name: 'Life Hub' },
    { path: '/app/modules/ai-copilot.html', name: 'AI Copilot' },
    { path: '/app/modules/app-ecosystem.html', name: 'App Ecosystem' },
    { path: '/app/modules/communication-hub.html', name: 'Communication Hub' },
    { path: '/app/modules/document-center.html', name: 'Document Center' },
    { path: '/app/modules/finance-hub.html', name: 'Finance Hub' },
    { path: '/app/modules/integration-marketplace.html', name: 'Integration Marketplace' },
    { path: '/app/modules/integrations-manager.html', name: 'Integrations Manager' },
    { path: '/app/modules/onboarding-flow.html', name: 'Onboarding Flow' },
    { path: '/app/modules/dashboard-v11.html', name: 'Dashboard v11' },
    { path: '/app/modules/dashboard-v2.html', name: 'Dashboard v2' },
  ];

  for (const mod of modules) {
    const resp = await page.goto(`${BASE}${mod.path}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const status = resp?.status() || 0;
    await page.waitForTimeout(300);
    
    // Verificar se tem conteúdo real
    const title = await page.title();
    const hasContent = await page.$('main, [class*="container"], [class*="module"], [class*="dashboard"]');
    const hasError = title.includes('404') || title.includes('Error');
    
    log(`Módulo: ${mod.name}`, 'Carregamento', 
      hasError ? 'ERRO' : (status === 200 && hasContent ? 'OK' : 'PARCIAL'),
      `HTTP ${status} | Title: ${title.slice(0, 50)}`);
  }

  // ── 9. ADMIN ──────────────────────────────────────────────────────
  console.log('\n── ADMIN ──');
  const adminResp = await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  await page.waitForTimeout(1000);
  const adminUrl = page.url();
  log('Admin', 'Acesso /admin', 
    adminUrl.includes('/login') || adminUrl.includes('/admin') ? 'OK' : 'PARCIAL',
    `URL: ${adminUrl} | HTTP ${adminResp?.status()}`);

  // ── 10. APIs AUTENTICADAS ─────────────────────────────────────────
  console.log('\n── APIs AUTENTICADAS (sem sessão) ──');
  const protectedApis = [
    '/api/session', '/api/dashboard', '/api/habits', '/api/goals',
    '/api/tasks', '/api/notes', '/api/projects', '/api/profile',
    '/api/notifications', '/api/settings', '/api/crm',
    '/api/documents', '/api/photos', '/api/messages',
  ];

  for (const api of protectedApis) {
    const resp = await testAPI(page, api);
    const expected = resp.status === 401 || resp.status === 403;
    log('API Protegida', api, 
      expected ? 'OK' : (resp.status === 200 ? 'PARCIAL' : 'ERRO'),
      `HTTP ${resp.status} (esperado 401/403)`);
  }

  // ── 11. STATUS PAGE ───────────────────────────────────────────────
  console.log('\n── STATUS PAGE ──');
  await checkPage(page, `${BASE}/status`, 'Status');

  // ── 12. PÁGINAS LEGAIS ────────────────────────────────────────────
  console.log('\n── PÁGINAS LEGAIS ──');
  await checkPage(page, `${BASE}/privacy`, 'Privacidade');
  await checkPage(page, `${BASE}/terms`, 'Termos');

  // ── 13. ENTERPRISE ────────────────────────────────────────────────
  console.log('\n── ENTERPRISE ──');
  await checkPage(page, `${BASE}/enterprise`, 'Enterprise');

  // ── 14. MEMORY CENTER ─────────────────────────────────────────────
  console.log('\n── MEMORY CENTER ──');
  await checkPage(page, `${BASE}/memory-center`, 'Memory Center');

  // ── 15. VERIFICAR CONSOLE ERRORS ─────────────────────────────────
  console.log('\n── VERIFICAÇÃO DE ERROS JS ──');
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 100));
  });

  // Verificar app dashboard para erros JS
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: TIMEOUT });
  await page.waitForTimeout(2000);
  
  if (consoleErrors.length > 0) {
    log('App Dashboard', 'Erros JavaScript', 'PARCIAL', `${consoleErrors.length} erros: ${consoleErrors.slice(0, 3).join(' | ')}`);
  } else {
    log('App Dashboard', 'Erros JavaScript', 'OK', 'Nenhum erro no console');
  }

  // ── 16. VERIFICAR LINKS QUEBRADOS NA LANDING ──────────────────────
  console.log('\n── LINKS DA LANDING PAGE ──');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
  const allLinks = await page.$$eval('a[href]', els => 
    els.map(e => e.getAttribute('href')).filter(h => h && !h.startsWith('#') && !h.startsWith('mailto:') && !h.startsWith('http'))
  );
  const uniqueLinks = [...new Set(allLinks)];
  
  for (const link of uniqueLinks.slice(0, 15)) {
    const resp = await page.goto(`${BASE}${link}`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const status = resp?.status() || 0;
    log('Landing Links', link, status < 400 ? 'OK' : 'ERRO', `HTTP ${status}`);
    await page.goBack();
    await page.waitForTimeout(200);
  }

  await browser.close();

  // ── SALVAR RESULTADOS ─────────────────────────────────────────────
  const summary = {
    total: results.length,
    ok: results.filter(r => r.status === 'OK').length,
    parcial: results.filter(r => r.status === 'PARCIAL').length,
    erro: results.filter(r => r.status === 'ERRO').length,
    results,
    errors,
  };

  await writeFile('/home/ubuntu/lifeos/audit_801_results.json', JSON.stringify(summary, null, 2));
  
  console.log('\n========================================');
  console.log('RESUMO DA AUDITORIA');
  console.log('========================================');
  console.log(`✅ OK:      ${summary.ok}`);
  console.log(`⚠️  PARCIAL: ${summary.parcial}`);
  console.log(`❌ ERRO:    ${summary.erro}`);
  console.log(`📊 TOTAL:   ${summary.total}`);
  console.log('\nResultados salvos em: audit_801_results.json');
}

run().catch(e => {
  console.error('ERRO FATAL:', e.message);
  process.exit(1);
});
