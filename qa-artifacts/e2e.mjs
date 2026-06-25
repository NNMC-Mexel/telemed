// Senior QA — Browser E2E (Playwright + system Chrome), 2026-06-24
// Run from frontend/ so playwright resolves: cd frontend && node ../qa-artifacts/e2e.mjs
import { chromium } from '/Users/aidarmukhamedin/Documents/projects/NNMC/teleMed/frontend/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';

const APP = process.env.APP || 'http://localhost:1342';
const OUT = path.resolve('../qa-artifacts/e2e');
fs.mkdirSync(OUT, { recursive: true });
const PW = 'QaTest!2026';
const ACC = {
  patient: 'qa_senior_patient_1780741939714@test.kz',
  doctor:  'qa_senior_doctor_1780741939714@test.kz',
  admin:   'qa_senior_admin_1780741939714@test.kz',
};
const ROUTES = {
  patient: ['/patient','/patient/doctors','/patient/appointments','/patient/chat','/patient/documents','/patient/profile'],
  doctor:  ['/doctor','/doctor/schedule','/doctor/patients','/doctor/chat','/doctor/profile'],
  admin:   ['/admin','/admin/users','/admin/doctors','/admin/promotions','/admin/appointments','/admin/specializations','/admin/support','/admin/settings'],
};
const IGNORE = [
  /favicon/i, /\/socket\.io\//i, /web_accessible/i, /ResizeObserver/i,
  /turn:/i, /stun:/i, /Download the React DevTools/i,
];
const ignored = (s) => IGNORE.some(r => r.test(s));

const report = { app: APP, when: new Date().toISOString(), roles: {} };

async function loginUI(page, role) {
  await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="identifier"]', ACC[role]);
  await page.fill('input[name="password"]', PW);
  await Promise.all([
    page.waitForURL(/\/(patient|doctor|admin|manager)/, { timeout: 15000 }).catch(()=>{}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
  return page.url();
}

async function visit(page, role, route, bucket) {
  const consoleErrors = [];
  const pageErrors = [];
  const failedReq = [];
  const onConsole = (msg) => { if (msg.type()==='error' && !ignored(msg.text())) consoleErrors.push(msg.text().slice(0,300)); };
  const onPageErr = (err) => { if (!ignored(String(err))) pageErrors.push(String(err).slice(0,300)); };
  const onResp = (res) => { const s=res.status(); if (s>=400 && !ignored(res.url())) failedReq.push(`${s} ${res.request().method()} ${res.url().replace(/^https?:\/\/[^/]+/,'')}`); };
  page.on('console', onConsole); page.on('pageerror', onPageErr); page.on('response', onResp);

  let finalUrl='', textLen=0, blank=false, err=null;
  try {
    await page.goto(`${APP}${route}`, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(1200);
    finalUrl = page.url();
    const bodyText = (await page.locator('body').innerText().catch(()=>'')) || '';
    textLen = bodyText.trim().length;
    blank = textLen < 20;
    const file = path.join(OUT, `${role}${route.replace(/\//g,'_')||'_root'}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(()=>{});
  } catch (e) { err = String(e).slice(0,200); }

  page.off('console', onConsole); page.off('pageerror', onPageErr); page.off('response', onResp);
  const entry = { route, finalUrl, textLen, blank, consoleErrors, pageErrors, failedReq, err };
  bucket.push(entry);
  const flag = (blank?'BLANK ':'') + (pageErrors.length?`PGERR:${pageErrors.length} `:'') + (consoleErrors.length?`CONERR:${consoleErrors.length} `:'') + (failedReq.length?`NET:${failedReq.length}`:'');
  console.log(`  ${role} ${route} -> ${finalUrl.replace(APP,'')} len=${textLen} ${flag||'ok'}`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const role of Object.keys(ROUTES)) {
    console.log(`\n=== ${role.toUpperCase()} ===`);
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'ru-RU' });
    const page = await ctx.newPage();
    const bucket = [];
    let loginUrl='';
    try {
      loginUrl = await loginUI(page, role);
      console.log(`  login -> ${loginUrl.replace(APP,'')}`);
    } catch (e) { console.log(`  LOGIN FAIL ${role}: ${e}`); }
    for (const route of ROUTES[role]) await visit(page, role, route, bucket);
    report.roles[role] = { loginUrl, pages: bucket };
    await ctx.close();
  }
  // anon redirect check
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${APP}/patient`, { waitUntil:'domcontentloaded' }).catch(()=>{});
  await page.waitForTimeout(1000);
  report.anonPatientRedirect = page.url().replace(APP,'');
  console.log(`\nanon /patient -> ${report.anonPatientRedirect}`);
  await ctx.close();
  await browser.close();

  fs.writeFileSync(path.join(OUT,'e2e-results.json'), JSON.stringify(report,null,2));
  // summary
  let blanks=0, pgerr=0, conerr=0, net=0;
  for (const r of Object.values(report.roles)) for (const p of r.pages) { if(p.blank)blanks++; pgerr+=p.pageErrors.length; conerr+=p.consoleErrors.length; net+=p.failedReq.length; }
  console.log(`\n=== E2E SUMMARY: blanks=${blanks} pageErrors=${pgerr} consoleErrors=${conerr} failedRequests=${net} ===`);
  console.log('Wrote qa-artifacts/e2e/e2e-results.json + screenshots');
})();
