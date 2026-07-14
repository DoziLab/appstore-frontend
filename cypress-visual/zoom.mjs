import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.OUT || 'cypress/screenshots-current';
const BASE = 'http://localhost:3000';
const FIX = 'cypress/fixtures';
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(FIX, p), 'utf8'));

const FIXTURES = {
  projects_single: readJson('openstack-projects/single.json'),
  quotas_default: readJson('quotas/default.json'),
  templates_approved: readJson('templates/approved-list.json'),
  template_detail: readJson('templates/detail-wordpress.json'),
  tv_list_wordpress: readJson('template-versions/list-wordpress.json'),
  tv_version_detail: readJson('template-versions/version-detail-wordpress.json'),
  flavors_list: readJson('flavors/list.json'),
};

const KEYCLOAK_ADMIN = readJson('keycloak/admin.json');
const KEYCLOAK_LECTURER = readJson('keycloak/lecturer.json');

function mockJson(body) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) };
}

async function mocks(context) {
  await context.route((url) => String(url).includes('/api/v1/'), async (route) => {
    const url = route.request().url();
    const routes = [
      [/\/api\/v1\/openstack-projects/, FIXTURES.projects_single],
      [/\/api\/v1\/quotas/, FIXTURES.quotas_default],
      [/\/api\/v1\/templates\/[^/]+\/versions/, FIXTURES.tv_list_wordpress],
      [/\/api\/v1\/templates\/[^/]+$/, FIXTURES.template_detail],
      [/\/api\/v1\/templates/, FIXTURES.templates_approved],
      [/\/api\/v1\/template-versions\/[^/]+/, FIXTURES.tv_version_detail],
      [/\/api\/v1\/(openstack\/)?flavors/, FIXTURES.flavors_list],
    ];
    for (const [re, body] of routes) {
      if (re.test(url)) return route.fulfill(mockJson(body));
    }
    return route.fulfill(mockJson({ success: true, data: [], errors: [], timestamp: '', request_id: 't', pagination: { total: 0, page: 1, page_size: 20 } }));
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  fs.mkdirSync(path.join(OUT, 'zoom'), { recursive: true });

  // 1) Lecturer search input (admin @ desktop)
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((s) => { window.__CYPRESS_KEYCLOAK_STUB__ = s; }, KEYCLOAK_ADMIN);
    await mocks(ctx);
    const p = await ctx.newPage();
    await p.goto(BASE + '/admin/lecturers', { waitUntil: 'domcontentloaded' });
    await p.locator('h1').filter({ hasText: 'Dozenten-Verwaltung' }).first().waitFor({ state: 'visible' });
    await p.waitForTimeout(500);
    // Focus the search input area and screenshot the card header only
    const searchWrapper = p.locator('input[placeholder*="Name, Email"]').locator('..');
    await searchWrapper.screenshot({ path: path.join(OUT, 'zoom', 'lecturer-search.png') });
    // Also a bigger crop for context
    const card = p.locator('.border-slate-200').filter({ has: p.locator('input[placeholder*="Name, Email"]') }).first();
    await card.screenshot({ path: path.join(OUT, 'zoom', 'lecturer-card-header.png') });
    await ctx.close();
  }

  // 2) AppStore template detail dialog (admin — sees owner-dialog with
  //    "Template löschen" + "Schließen" over a separator, which is the
  //    UI we want to verify)
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript((s) => { window.__CYPRESS_KEYCLOAK_STUB__ = s; }, KEYCLOAK_ADMIN);
    await mocks(ctx);
    const p = await ctx.newPage();
    await p.goto(BASE + '/appstore', { waitUntil: 'domcontentloaded' });
    await p.locator('h1').filter({ hasText: 'App Store' }).first().waitFor({ state: 'visible' });
    await p.waitForTimeout(400);
    const firstDetailsBtn = p.getByRole('button', { name: 'Details' }).first();
    await firstDetailsBtn.click();
    await p.waitForTimeout(1000);
    const dialog = p.locator('[role="dialog"]').first();
    await dialog.screenshot({ path: path.join(OUT, 'zoom', 'template-detail-full.png') });
    // Scroll the dialog to bottom so the footer with delete+close is in
    // frame.
    await p.evaluate(() => {
      const d = document.querySelector('[role="dialog"]');
      if (!d) return;
      d.scrollTo({ top: d.scrollHeight, behavior: 'instant' });
    });
    await p.waitForTimeout(300);
    await dialog.screenshot({ path: path.join(OUT, 'zoom', 'template-detail-footer.png') });
    await ctx.close();
  }

  await browser.close();
  console.log('done');
}

main().catch((e) => { console.error(e); process.exit(1); });
