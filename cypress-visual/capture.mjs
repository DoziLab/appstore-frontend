// Visual capture harness — replaces the earlier Cypress spec after Cypress
// 15 refused to launch on this macOS 26 host (bad options / xattr blocked).
// Uses Playwright headless-chromium against a running Vite dev server on
// http://localhost:3000, mocks Keycloak the same way the Cypress support
// commands do (window.__CYPRESS_KEYCLOAK_STUB__ read at module load in
// src/auth/keycloak.ts), and stubs every /api/v1/... endpoint the pages
// touch with the fixtures already sitting under cypress/fixtures/.
//
// Usage:
//   OUT=cypress/screenshots-baseline node cypress-visual/capture.mjs
//   OUT=cypress/screenshots-current  node cypress-visual/capture.mjs

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.OUT || 'cypress/screenshots-current';
const BASE = 'http://localhost:3000';
const FIX = 'cypress/fixtures';

const readJson = (p) => JSON.parse(fs.readFileSync(path.join(FIX, p), 'utf8'));

// Ready-fixtures pre-loaded — Playwright's route handler is sync/async and
// we don't want to hit disk per request.
const FIXTURES = {
  projects_single: readJson('openstack-projects/single.json'),
  quotas_default: readJson('quotas/default.json'),
  deployments_empty: readJson('deployments/empty.json'),
  deployments_list3: readJson('deployments/list-3.json'),
  templates_approved: readJson('templates/approved-list.json'),
  tv_queue_empty: readJson('template-versions/queue-empty.json'),
  tv_queue_pending: readJson('template-versions/queue-pending.json'),
  courses_list: readJson('courses/list.json'),
  keycloak_groups: readJson('keycloak-groups/list.json'),
  flavors_list: readJson('flavors/list.json'),
  student_empty: {
    success: true,
    data: [],
    errors: [],
    timestamp: '2026-07-01T00:00:00Z',
    request_id: 'test',
  },
};

const KEYCLOAK = {
  lecturer: readJson('keycloak/lecturer.json'),
  admin: readJson('keycloak/admin.json'),
  student: readJson('keycloak/student.json'),
};

// Per-page overrides (mirrors the Cypress spec).
const PAGES = [
  { slug: '01-dashboard', url: '/dashboard', role: 'lecturer', ready: 'Dashboard', overrides: { deployments: 'list3' } },
  { slug: '02-appstore', url: '/appstore', role: 'lecturer', ready: 'App Store' },
  { slug: '03-courses', url: '/courses', role: 'lecturer', ready: 'Kurse' },
  { slug: '04-config-settings', url: '/config', role: 'lecturer', ready: 'Einstellungen' },
  { slug: '05-admin-projects', url: '/admin/projects', role: 'admin', ready: 'Projektübersicht', overrides: { deployments: 'list3' } },
  { slug: '06-admin-templates', url: '/admin/templates', role: 'admin', ready: 'Template-Freigaben', overrides: { tv_queue: 'pending' } },
  { slug: '07-admin-lecturers', url: '/admin/lecturers', role: 'admin', ready: 'Dozenten-Verwaltung' },
  { slug: '08-student-dashboard', url: '/student/dashboard', role: 'student', ready: 'Meine Deployments' },
];

const VIEWPORTS = [
  { folder: 'desktop', w: 1440, h: 900 },
  { folder: 'mobile', w: 390, h: 844 },
];

function mockJson(body) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(body) };
}

/**
 * Register API interceptors on the given browser context. Matches only
 * relative /api/v1/... requests (Vite proxies these; our stubs bypass the
 * proxy entirely so no backend is needed).
 */
async function wireMocks(context, overrides = {}) {
  const routes = [
    // openstack projects — lecturer needs a project or App.tsx traps them in setup
    [/\/api\/v1\/openstack-projects(\?|\/|$)/, FIXTURES.projects_single],
    [/\/api\/v1\/quotas/, FIXTURES.quotas_default],
    // deployments — /api/v1/deployments and /api/v1/deployments?..., but NOT nested
    [/\/api\/v1\/deployments(\?[^/]*)?$/, overrides.deployments === 'list3' ? FIXTURES.deployments_list3 : FIXTURES.deployments_empty],
    [/\/api\/v1\/templates(\?|\/|$)/, FIXTURES.templates_approved],
    [/\/api\/v1\/template-versions\/queue(\?|$)/, overrides.tv_queue === 'pending' ? FIXTURES.tv_queue_pending : FIXTURES.tv_queue_empty],
    [/\/api\/v1\/template-versions(\?|\/|$)/, FIXTURES.tv_queue_empty],
    [/\/api\/v1\/courses(\?|\/|$)/, FIXTURES.courses_list],
    [/\/api\/v1\/keycloak\/groups(\?|\/|$)/, FIXTURES.keycloak_groups],
    [/\/api\/v1\/openstack\/flavors(\?|\/|$)/, FIXTURES.flavors_list],
    [/\/api\/v1\/flavors(\?|\/|$)/, FIXTURES.flavors_list],
    [/\/api\/v1\/student\/deployments/, FIXTURES.student_empty],
  ];

  await context.route((url) => {
    const s = typeof url === 'string' ? url : url.toString();
    return s.includes('/api/v1/');
  }, async (route) => {
    const url = route.request().url();
    for (const [re, body] of routes) {
      if (re.test(url)) {
        return route.fulfill(mockJson(body));
      }
    }
    // Unhandled admin endpoints (e.g. /api/v1/admin/lecturers). Return an
    // empty successful envelope so the page renders its empty-state rather
    // than an error-state.
    return route.fulfill(mockJson({ success: true, data: [], errors: [], timestamp: '2026-07-01T00:00:00Z', request_id: 'test', pagination: { total: 0, page: 1, page_size: 20 } }));
  });
}

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  fs.mkdirSync(path.join(OUT, 'desktop'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'mobile'), { recursive: true });

  for (const vp of VIEWPORTS) {
    for (const page of PAGES) {
      const stub = KEYCLOAK[page.role];
      const context = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        deviceScaleFactor: 1,
      });
      // Set the auth stub BEFORE any app code runs. Same trick as Cypress
      // loginAs — src/auth/keycloak.ts reads this global at module load
      // and monkey-patches the singleton.
      await context.addInitScript((stubJson) => {
        window.__CYPRESS_KEYCLOAK_STUB__ = stubJson;
      }, stub);
      await wireMocks(context, page.overrides ?? {});

      const p = await context.newPage();
      const errors = [];
      p.on('pageerror', (e) => errors.push(String(e)));
      p.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text()); });

      let outcome = 'ok';
      try {
        await p.goto(BASE + page.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // Wait for the h1 with the ready text — matches the page-header
        // heading, not the sidebar nav link (which is hidden on mobile).
        // Fall back to a generic visible match if no h1 fits.
        const headingLoc = p.locator('h1').filter({ hasText: page.ready }).first();
        try {
          await headingLoc.waitFor({ state: 'visible', timeout: 15000 });
        } catch {
          await p.locator(`:visible:has-text("${page.ready}")`).first().waitFor({ timeout: 5000 });
        }
        // Let Radix/Recharts settle
        await p.waitForTimeout(500);
        const shotPath = path.join(OUT, vp.folder, `${page.slug}.png`);
        await p.screenshot({ path: shotPath, fullPage: false });
        results.push({ vp: vp.folder, slug: page.slug, path: shotPath, outcome, errors });
      } catch (err) {
        outcome = 'error:' + err.message;
        const shotPath = path.join(OUT, vp.folder, `${page.slug}--ERROR.png`);
        try { await p.screenshot({ path: shotPath, fullPage: false }); } catch {}
        results.push({ vp: vp.folder, slug: page.slug, path: shotPath, outcome, errors });
      } finally {
        await context.close();
      }
    }

    // Mobile-only extra: hamburger drawer
    if (vp.folder === 'mobile') {
      const context = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
      await context.addInitScript((stubJson) => {
        window.__CYPRESS_KEYCLOAK_STUB__ = stubJson;
      }, KEYCLOAK.lecturer);
      await wireMocks(context);
      const p = await context.newPage();
      let outcome = 'ok';
      try {
        await p.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded' });
        await p.locator('h1').filter({ hasText: 'Dashboard' }).first().waitFor({ state: 'visible', timeout: 15000 });
        const btn = p.getByLabel('Menü öffnen');
        await btn.waitFor({ timeout: 5000 });
        await btn.click();
        // Wait for the drawer nav link to be *visible* (not just present).
        // The Sheet primitive slides in with a 500ms animation.
        await p.locator('[role="dialog"] a', { hasText: 'Kurse' }).first().waitFor({ state: 'visible', timeout: 5000 });
        // Give the slide-in animation an extra buffer to fully settle.
        await p.waitForTimeout(1200);
        const shotPath = path.join(OUT, 'mobile', '09-drawer-open.png');
        await p.screenshot({ path: shotPath, fullPage: false });
        results.push({ vp: 'mobile', slug: '09-drawer-open', path: shotPath, outcome, errors: [] });
      } catch (err) {
        outcome = 'error:' + err.message;
        results.push({ vp: 'mobile', slug: '09-drawer-open', path: null, outcome, errors: [] });
      } finally {
        await context.close();
      }
    }
  }

  await browser.close();

  const summary = results.map((r) => `${r.vp.padEnd(7)} ${r.slug.padEnd(24)} ${r.outcome}${r.errors && r.errors.length ? ' [' + r.errors.length + ' console errs]' : ''}`).join('\n');
  fs.writeFileSync(path.join(OUT, 'summary.txt'), summary + '\n');
  console.log(summary);

  const failed = results.filter((r) => r.outcome !== 'ok');
  if (failed.length > 0) {
    console.error(`\n${failed.length} page(s) failed to capture.`);
    process.exit(1);
  }
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
