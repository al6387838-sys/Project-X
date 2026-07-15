import { chromium } from 'playwright';
import fs from 'node:fs';

const baseURL = process.env.BASE_URL || 'http://127.0.0.1:8790';
const artifactsDir = 'artifacts/onboarding-v11';
fs.mkdirSync(artifactsDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const email = `onboarding.qa.${Date.now()}@example.com`;
const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
  console.log(`${condition ? '✓' : '✗'} ${message}`);
}

try {
  const register = await context.request.post(`${baseURL}/api/register`, {
    data: { name: 'Marina QA', email, password: 'LifeOS-QA-2026!' },
  });
  check(register.status() === 201, `Cadastro autenticado responde 201 (recebido ${register.status()})`);

  await page.goto(`${baseURL}/app?onboarding=true`, { waitUntil: 'networkidle' });
  await page.locator('#modal-onboarding.active').waitFor({ timeout: 10000 });
  check(await page.locator('#onboarding-title').textContent() === 'Bem-vindo ao seu LifeOS', 'Tela de boas-vindas exibida');
  await page.screenshot({ path: `${artifactsDir}/01-welcome-desktop.png`, fullPage: true });

  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.locator('#onboarding-title').filter({ hasText: 'Como você trabalha?' }).waitFor();
  await page.locator('#ob-role').selectOption({ label: 'Gestor(a) / Líder' });
  await page.locator('#ob-company').fill('Orion Operações');
  check(await page.locator('#ob-name').inputValue() === 'Marina QA', 'Perfil pré-preenchido com o cadastro');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${artifactsDir}/02-profile-mobile.png`, fullPage: true });
  const modalBox = await page.locator('#modal-onboarding .modal-box').boundingBox();
  check(Boolean(modalBox && modalBox.width <= 390 && modalBox.height <= 844), 'Modal de perfil contido no viewport móvel');
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  check(!horizontalOverflow, 'Sem overflow horizontal no onboarding móvel');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.locator('input[name="ob-goals"][value="productivity"]').check();
  await page.locator('input[name="ob-goals"][value="leadership"]').check();
  await page.locator('#ob-custom-goal').fill('Concluir a implantação do centro operacional');
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.locator('input[name="ob-integrations"][value="google"]').check();
  await page.locator('input[name="ob-integrations"][value="github"]').check();
  await page.getByRole('button', { name: 'Continuar' }).click();

  await page.locator('input[name="ob-notifications"][value="weeklyDigest"]').uncheck();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.locator('#onboarding-title').filter({ hasText: 'Seu espaço está pronto' }).waitFor();
  check(await page.locator('#onboarding-title').textContent() === 'Seu espaço está pronto', 'Resumo final exibe a configuração coletada');
  check((await page.locator('.onboarding-summary').textContent()).includes('Orion Operações'), 'Resumo contém o contexto profissional');
  await page.screenshot({ path: `${artifactsDir}/03-review-desktop.png`, fullPage: true });

  await page.getByRole('button', { name: 'Concluir e iniciar tour' }).click();
  await page.locator('.guided-tour-card').waitFor({ timeout: 7000 });
  check(await page.locator('.guided-tour-card').isVisible(), 'Tour guiado iniciado após a conclusão');
  for (let index = 0; index < 5; index += 1) {
    const next = page.locator('.guided-tour-card .btn-primary');
    await next.click();
    if (index < 4) await page.locator('.guided-tour-card').waitFor();
  }
  await page.locator('#first-steps.open').waitFor({ timeout: 5000 });
  check(await page.locator('#first-steps-list input').count() === 4, 'Checklist apresenta quatro primeiros passos');
  await page.locator('input[data-first-step="commandCenter"]').check();
  await page.screenshot({ path: `${artifactsDir}/04-checklist.png`, fullPage: true });

  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), 'lifeos_enterprise_onboarding_v1');
  check(state?.completed === true, 'Conclusão persistida no navegador');
  check(state?.tourCompleted === true, 'Conclusão do tour persistida no navegador');
  check(state?.profile?.company === 'Orion Operações', 'Perfil empresarial persistido localmente');
  check(state?.goals?.includes('leadership'), 'Objetivos persistidos localmente');

  const storedResult = await page.evaluate(async () => {
    const response = await fetch('/api/onboarding', { credentials: 'same-origin' });
    return { status: response.status, body: await response.json() };
  });
  const stored = storedResult.body;
  check(storedResult.status === 200 && stored.ok, `Consulta de onboarding persistido responde com sucesso (${storedResult.status})`);
  check(Boolean(stored.onboarding?.completedAt), 'Conclusão persistida no Cloudflare KV');
  check(stored.onboarding?.profile?.company === 'Orion Operações', 'Perfil persistido no Cloudflare KV');
  check(stored.onboarding?.integrations?.integrations?.includes('github'), 'Integrações persistidas no Cloudflare KV');

  const userDataResult = await page.evaluate(async () => {
    const response = await fetch('/api/user-data', { credentials: 'same-origin' });
    return { status: response.status, body: await response.json() };
  });
  check(userDataResult.status === 200 && userDataResult.body.ok, 'Perfil principal responde após conclusão');
  check(userDataResult.body.user?.name === 'Marina QA', 'Nome consolidado no perfil principal');
  check(userDataResult.body.user?.professionalRole === 'Gestor(a) / Líder', 'Função profissional consolidada no perfil principal');
  check(userDataResult.body.user?.company === 'Orion Operações', 'Empresa consolidada no perfil principal');
  check(userDataResult.body.user?.preparedIntegrations?.includes('github'), 'Integrações preparadas consolidadas no perfil principal');
  check(userDataResult.body.user?.notificationPreferences?.weeklyDigest === false, 'Preferências de notificação consolidadas no perfil principal');

  await page.reload({ waitUntil: 'networkidle' });
  check(!(await page.locator('#modal-onboarding.active').isVisible()), 'Onboarding concluído não reaparece após recarregar');
} catch (error) {
  failures.push(error.stack || String(error));
  console.error(error);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error(`\n${failures.length} falha(s):`);
  failures.forEach(failure => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('\nOnboarding empresarial v11.1: aprovado.');
