// Comprehensive visual-capture harness (Playwright headless).
//
// Covers every page AND the key popups/dialogs, at desktop (1440×900) and
// mobile (390×844). Keycloak is stubbed via window.__CYPRESS_KEYCLOAK_STUB__
// (read by src/auth/keycloak.ts at module load); all /api/v1/* calls are
// intercepted with the fixtures under cypress/fixtures/. No backend needed.
//
//   OUT=cypress/shots node cypress-visual/capture-all.mjs
//
// Screenshots land under $OUT/<viewport>/<slug>.png.

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.OUT || 'cypress/shots';
const BASE = 'http://localhost:3000';
const FIX = 'cypress/fixtures';
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(FIX, p), 'utf8'));

const F = {
  projects_single: readJson('openstack-projects/single.json'),
  quotas: readJson('quotas/default.json'),
  deployments_list3: readJson('deployments/list-3.json'),
  deployments_empty: readJson('deployments/empty.json'),
  detail_running: readJson('deployments/detail-running.json'),
  templates: readJson('templates/approved-list.json'),
  template_detail: readJson('templates/detail-wordpress.json'),
  tv_list: readJson('template-versions/list-wordpress.json'),
  tv_detail: readJson('template-versions/version-detail-wordpress.json'),
  tv_queue_pending: readJson('template-versions/queue-pending.json'),
  courses: readJson('courses/list.json'),
  kc_groups: readJson('keycloak-groups/list.json'),
  flavors: readJson('flavors/list.json'),
  lecturers_list: readJson('lecturers/list.json'),
  lecturer_detail: readJson('lecturers/detail.json'),
  student_list: readJson('deployments/student-list.json'),
  student_creds: readJson('deployments/student-credentials.json'),
};

const KC = {
  lecturer: readJson('keycloak/lecturer.json'),
  admin: readJson('keycloak/admin.json'),
  student: readJson('keycloak/student.json'),
};

const ok = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const emptyEnvelope = { success: true, data: [], errors: null, timestamp: '2026-07-10T00:00:00Z', request_id: 't', pagination: { page: 1, page_size: 20, total_items: 0, total_pages: 1 } };

async function wire(context) {
  await context.route((u) => String(u).includes('/api/v1/'), async (route) => {
    const url = route.request().url();
    const R = [
      [/\/api\/v1\/openstack-projects/, F.projects_single],
      [/\/api\/v1\/quotas/, F.quotas],
      [/\/api\/v1\/student\/deployments\/[^/]+\/credentials/, F.student_creds],
      [/\/api\/v1\/student\/deployments/, F.student_list],
      [/\/api\/v1\/lecturers\/[^/]+/, F.lecturer_detail],
      [/\/api\/v1\/lecturers/, F.lecturers_list],
      [/\/api\/v1\/deployments\/[^/]+$/, F.detail_running],
      [/\/api\/v1\/deployments(\?[^/]*)?$/, F.deployments_list3],
      [/\/api\/v1\/templates\/[^/]+\/versions/, F.tv_list],
      [/\/api\/v1\/templates\/[^/]+$/, F.template_detail],
      [/\/api\/v1\/templates/, F.templates],
      [/\/api\/v1\/template-versions\/queue/, F.tv_queue_pending],
      [/\/api\/v1\/template-versions\/[^/]+/, F.tv_detail],
      [/\/api\/v1\/template-versions/, F.tv_queue_pending],
      [/\/api\/v1\/courses/, F.courses],
      [/\/api\/v1\/keycloak\/groups/, F.kc_groups],
      [/\/api\/v1\/(openstack\/)?flavors/, F.flavors],
    ];
    for (const [re, body] of R) if (re.test(url)) return route.fulfill(ok(body));
    return route.fulfill(ok(emptyEnvelope));
  });
}

async function newPage(browser, role, vp) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  await ctx.addInitScript((s) => { window.__CYPRESS_KEYCLOAK_STUB__ = s; }, KC[role]);
  await wire(ctx);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  return { ctx, p, errors };
}

// Pages: [slug, url, role, readyHeadingText]
const PAGES = [
  ['01-dashboard', '/dashboard', 'lecturer', 'Dashboard'],
  ['02-appstore', '/appstore', 'lecturer', 'App Store'],
  ['03-courses', '/courses', 'lecturer', 'Kurse'],
  ['04-config-settings', '/config', 'lecturer', 'Einstellungen'],
  ['05-admin-projects', '/admin/projects', 'admin', 'Projektübersicht'],
  ['06-admin-templates', '/admin/templates', 'admin', 'Template-Freigaben'],
  ['07-admin-lecturers', '/admin/lecturers', 'admin', 'Dozenten-Verwaltung'],
  ['08-student-dashboard', '/student/dashboard', 'student', 'Meine Deployments'],
  ['09-student-deployment-detail', '/student/deployment/dep-stud-1', 'student', 'test-studenten-rolle'],
  ['10-deployment-detail', '/deployment/dep-alpha-0001', 'lecturer', 'test-deploy-alpha'],
];

const VIEWPORTS = [
  { folder: 'desktop', w: 1440, h: 900 },
  { folder: 'mobile', w: 390, h: 844 },
];

async function shoot(p, out, folder, slug) {
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(out, folder, `${slug}.png`), fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const vp of VIEWPORTS) fs.mkdirSync(path.join(OUT, vp.folder), { recursive: true });

  for (const vp of VIEWPORTS) {
    for (const [slug, url, role, ready] of PAGES) {
      const { ctx, p, errors } = await newPage(browser, role, vp);
      let outcome = 'ok';
      try {
        await p.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const heading = p.locator('h1,h2,h3').filter({ hasText: ready }).first();
        try { await heading.waitFor({ state: 'visible', timeout: 15000 }); }
        catch { await p.getByText(ready, { exact: false }).first().waitFor({ timeout: 5000 }); }
        await shoot(p, OUT, vp.folder, slug);
      } catch (e) {
        outcome = 'ERROR: ' + e.message.split('\n')[0];
        try { await p.screenshot({ path: path.join(OUT, vp.folder, `${slug}--ERR.png`), fullPage: true }); } catch {}
      }
      results.push(`${vp.folder.padEnd(7)} ${slug.padEnd(32)} ${outcome}${errors.length ? ' [' + errors.length + ' err]' : ''}`);
      await ctx.close();
    }

    // ── POPUPS ──────────────────────────────────────────────────────────
    // P1: Template owner detail dialog (admin @ appstore → Details)
    {
      const { ctx, p, errors } = await newPage(browser, 'admin', vp);
      let outcome = 'ok';
      try {
        await p.goto(BASE + '/appstore', { waitUntil: 'domcontentloaded' });
        await p.locator('h1').filter({ hasText: 'App Store' }).first().waitFor({ state: 'visible', timeout: 15000 });
        await p.getByRole('button', { name: 'Details' }).first().click();
        await p.locator('[role="dialog"]').first().waitFor({ timeout: 8000 });
        await p.waitForTimeout(800);
        await p.screenshot({ path: path.join(OUT, vp.folder, 'popup-01-template-owner-dialog.png'), fullPage: false });
      } catch (e) { outcome = 'ERROR: ' + e.message.split('\n')[0]; }
      results.push(`${vp.folder.padEnd(7)} ${'popup-01-template-owner'.padEnd(32)} ${outcome}${errors.length ? ' [' + errors.length + ' err]' : ''}`);
      await ctx.close();
    }

    // P2: Lecturer detail dialog (admin @ lecturers → click row)
    {
      const { ctx, p, errors } = await newPage(browser, 'admin', vp);
      let outcome = 'ok';
      try {
        await p.goto(BASE + '/admin/lecturers', { waitUntil: 'domcontentloaded' });
        await p.locator('h1').filter({ hasText: 'Dozenten-Verwaltung' }).first().waitFor({ state: 'visible', timeout: 15000 });
        await p.getByText('Ramona Korten').first().click();
        await p.locator('[role="dialog"]').first().waitFor({ timeout: 8000 });
        await p.waitForTimeout(800);
        await p.screenshot({ path: path.join(OUT, vp.folder, 'popup-02-lecturer-detail-dialog.png'), fullPage: false });

        // P3: delete-confirm dialog (click "Account löschen")
        const delBtn = p.getByRole('button', { name: /Account löschen/ }).first();
        if (await delBtn.count()) {
          await delBtn.click();
          await p.waitForTimeout(700);
          await p.screenshot({ path: path.join(OUT, vp.folder, 'popup-03-lecturer-delete-confirm.png'), fullPage: false });
        }
      } catch (e) { outcome = 'ERROR: ' + e.message.split('\n')[0]; }
      results.push(`${vp.folder.padEnd(7)} ${'popup-02/03-lecturer'.padEnd(32)} ${outcome}${errors.length ? ' [' + errors.length + ' err]' : ''}`);
      await ctx.close();
    }

    // P4: Admin group-by select popup (mobile shows OS popup; capture the page with select focused)
    {
      const { ctx, p, errors } = await newPage(browser, 'admin', vp);
      let outcome = 'ok';
      try {
        await p.goto(BASE + '/admin/projects', { waitUntil: 'domcontentloaded' });
        await p.locator('h1').filter({ hasText: 'Projektübersicht' }).first().waitFor({ state: 'visible', timeout: 15000 });
        await p.waitForTimeout(500);
        await p.screenshot({ path: path.join(OUT, vp.folder, 'popup-04-admin-groupby.png'), fullPage: false });
      } catch (e) { outcome = 'ERROR: ' + e.message.split('\n')[0]; }
      results.push(`${vp.folder.padEnd(7)} ${'popup-04-admin-groupby'.padEnd(32)} ${outcome}${errors.length ? ' [' + errors.length + ' err]' : ''}`);
      await ctx.close();
    }

    // P5 (mobile only): hamburger drawer
    if (vp.folder === 'mobile') {
      const { ctx, p, errors } = await newPage(browser, 'lecturer', vp);
      let outcome = 'ok';
      try {
        await p.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
        await p.locator('h1').filter({ hasText: 'Dashboard' }).first().waitFor({ state: 'visible', timeout: 15000 });
        await p.getByLabel('Menü öffnen').click();
        await p.locator('[role="dialog"] a', { hasText: 'Kurse' }).first().waitFor({ timeout: 5000 });
        await p.waitForTimeout(600);
        await p.screenshot({ path: path.join(OUT, vp.folder, 'popup-05-mobile-drawer.png'), fullPage: false });
      } catch (e) { outcome = 'ERROR: ' + e.message.split('\n')[0]; }
      results.push(`${vp.folder.padEnd(7)} ${'popup-05-mobile-drawer'.padEnd(32)} ${outcome}${errors.length ? ' [' + errors.length + ' err]' : ''}`);
      await ctx.close();
    }
  }

  await browser.close();
  const summary = results.join('\n');
  fs.writeFileSync(path.join(OUT, 'summary.txt'), summary + '\n');
  console.log(summary);
  const failed = results.filter((r) => r.includes('ERROR'));
  if (failed.length) { console.error(`\n${failed.length} capture(s) failed.`); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(1); });
