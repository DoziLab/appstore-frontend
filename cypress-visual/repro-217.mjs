// Reproduction harness for issue #217 — mobile DeploymentWizard UI bugs.
//
// Drives /deploy/:templateId as a lecturer at 390×844 (mobile), selects a
// version + course-group so the wizard reaches:
//   (a) the group-management header ("Gruppenverwaltung" + Auto-Verteilen +
//       green "Gruppe hinzufügen") — reported overflow off the right edge
//   (b) a multi-step progress bar (Template/Konfiguration/Netzwerk/Übersicht)
//       whose labels overlap on narrow viewports
//
// Emits screenshots + a document-overflow report (docScrollW vs innerW). A
// horizontal scrollbar on <html> is the machine-checkable symptom of the bug.
//
//   OUT=cypress/shots-217 node cypress-visual/repro-217.mjs

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.env.OUT || 'cypress/shots-217';
const BASE = 'http://localhost:3000';
const FIX = 'cypress/fixtures';
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(FIX, p), 'utf8'));

const KC = readJson('keycloak/lecturer.json');
const projectsSingle = readJson('openstack-projects/single.json');

// Template + versions
const template = {
  success: true, message: 'ok', errors: null, timestamp: '2026-07-10T00:00:00Z', request_id: 't',
  data: { id: 'tpl-repro', name: 'Repro Multi-User Ubuntu', description: 'Repro template', visibility: 'public', approval_status: 'approved' },
};
const versions = {
  success: true, message: 'ok', errors: null, timestamp: '2026-07-10T00:00:00Z', request_id: 't',
  data: [{ id: 'tv-repro-1', template_id: 'tpl-repro', version: '2.1.0', is_active: true, approval_status: 'approved' }],
};
// Version WITH config + network params so the wizard builds all 4 steps
// (Template / Konfiguration / Netzwerk / Übersicht) → reproduces label overlap.
const versionDetail = {
  success: true, message: 'ok', errors: null, timestamp: '2026-07-10T00:00:00Z', request_id: 't',
  data: {
    id: 'tv-repro-1', template_id: 'tpl-repro', version: '2.1.0', is_active: true,
    approval_status: 'approved', allow_user_files: false, user_files: [],
    parameters: [
      { name: 'admin_password', label: 'Admin Passwort', type: 'string', default: 'changeme', required: true },
      { name: 'network_cidr', label: 'Netzwerk CIDR', type: 'string', default: '10.0.0.0/24', required: false },
    ],
  },
};

// Keycloak groups (courses) + members — hit Keycloak directly, not /api/v1.
const kcGroups = [
  { id: 'grp-repro-1', name: 'SS26 Kurs Repro', path: '/SS26 Kurs Repro' },
];
const kcMembers = [
  'Lukas Koch', 'Sophie Wagner', 'Jonas Becker', 'Laura Hoffmann', 'Felix Schulz',
  'Lena Zimmermann', 'Niklas Braun', 'Mia Krause', 'David Hartmann',
].map((n, i) => {
  const [firstName, lastName] = n.split(' ');
  return { id: `u-${i}`, username: n.toLowerCase().replace(' ', '.'), firstName, lastName, enabled: true, emailVerified: true, email: `${n.toLowerCase().replace(' ', '.')}@dhbw.de` };
});

const ok = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
const emptyEnvelope = { success: true, data: [], errors: null, timestamp: '2026-07-10T00:00:00Z', request_id: 't', pagination: { page: 1, page_size: 20, total_items: 0, total_pages: 1 } };

async function wire(context) {
  // Keycloak admin REST (groups + members)
  await context.route((u) => String(u).includes('/admin/realms/'), async (route) => {
    const url = route.request().url();
    if (/\/groups\/[^/]+\/members/.test(url)) return route.fulfill(ok(kcMembers));
    if (/\/groups(\?|$)/.test(url) || /\/groups$/.test(url)) return route.fulfill(ok(kcGroups));
    return route.fulfill(ok([]));
  });
  await context.route((u) => String(u).includes('/api/v1/'), async (route) => {
    const url = route.request().url();
    const R = [
      [/\/api\/v1\/openstack-projects/, projectsSingle],
      [/\/api\/v1\/template-versions\/template\//, versions],
      [/\/api\/v1\/template-versions\/[^/]+/, versionDetail],
      [/\/api\/v1\/templates\/[^/]+\/versions/, versions],
      [/\/api\/v1\/templates\/[^/]+$/, template],
      [/\/api\/v1\/quotas/, emptyEnvelope],
      [/\/api\/v1\/(openstack\/)?flavors/, emptyEnvelope],
      [/\/api\/v1\/courses/, emptyEnvelope],
    ];
    for (const [re, body] of R) if (re.test(url)) return route.fulfill(ok(body));
    return route.fulfill(ok(emptyEnvelope));
  });
}

async function overflowReport(p) {
  return await p.evaluate(() => {
    const de = document.documentElement;
    const winW = window.innerWidth;
    const docW = de.scrollWidth;
    // Find elements wider than viewport / poking past right edge
    const offenders = [];
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > winW + 1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && el.className.toString ? el.className.toString() : '').slice(0, 80),
          text: (el.textContent || '').trim().slice(0, 40),
          right: Math.round(r.right),
        });
      }
    }
    // Dedup-ish: keep the 12 furthest-right
    offenders.sort((a, b) => b.right - a.right);
    return { winW, docW, hasHScroll: docW > winW, offenders: offenders.slice(0, 12) };
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const VW = parseInt(process.env.VW || '390', 10);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: VW, height: 844 } });
  await ctx.addInitScript((s) => { window.__CYPRESS_KEYCLOAK_STUB__ = s; }, KC);
  await wire(ctx);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));

  const log = [];
  await p.goto(BASE + '/deploy/tpl-repro', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.waitForTimeout(1500);

  // Step 0 initial (Template & Zugriff) — capture progress bar + overflow
  await p.screenshot({ path: path.join(OUT, 'step0-initial.png'), fullPage: true });
  log.push(['step0-initial', await overflowReport(p)]);

  // Fill deployment name so the "Direkt zur Übersicht" button enables
  try {
    await p.locator('#deployment-name').fill('repro-ss26-gruppe1', { timeout: 5000 });
    await p.waitForTimeout(300);
  } catch (e) { log.push(['name-fill-ERR', String(e).split('\n')[0]]); }

  // Select course group: the combobox whose text is the "Kurs auswählen" placeholder
  try {
    const combos = p.locator('button[role="combobox"]');
    const n = await combos.count();
    let kursIdx = -1;
    for (let i = 0; i < n; i++) {
      const t = (await combos.nth(i).textContent()) || '';
      if (/Kurs auswählen|WWI23SEB|Lädt/.test(t)) { kursIdx = i; break; }
    }
    if (kursIdx >= 0) {
      await combos.nth(kursIdx).click({ timeout: 5000 });
      await p.waitForTimeout(400);
      await p.getByRole('option').first().click({ timeout: 5000 });
      await p.waitForTimeout(1200); // members load + groups auto-build
    } else {
      log.push(['kurs-combo', `not found among ${n} comboboxes`]);
    }
  } catch (e) { log.push(['group-select-ERR', String(e).split('\n')[0]]); }

  await p.screenshot({ path: path.join(OUT, 'step0-groupmgmt.png'), fullPage: true });
  log.push(['step0-groupmgmt', await overflowReport(p)]);

  // Footer navigation on step 0 — the "Detaillierte Konfiguration" +
  // "Direkt zur Übersicht" pair that overflowed off the right edge.
  try {
    const abBtn = p.getByRole('button', { name: /^Abbrechen$/ }).first();
    if (await abBtn.count()) await abBtn.scrollIntoViewIfNeeded({ timeout: 4000 });
    await p.waitForTimeout(400);
    await p.screenshot({ path: path.join(OUT, 'footer-viewport.png'), fullPage: false });
    log.push(['footer-viewport', await overflowReport(p)]);
  } catch (e) { log.push(['footer-ERR', String(e).split('\n')[0]]); }

  // Advance to "Detaillierte Konfiguration" to reach the multi-step bar
  try {
    const detailBtn = p.getByRole('button', { name: /Detaillierte Konfiguration/ }).first();
    if (await detailBtn.count()) {
      await detailBtn.click({ timeout: 5000 });
      await p.waitForTimeout(800);
      await p.screenshot({ path: path.join(OUT, 'step1-konfiguration.png'), fullPage: true });
      log.push(['step1-konfiguration', await overflowReport(p)]);
    }
  } catch (e) { log.push(['detail-ERR', String(e).split('\n')[0]]); }

  await browser.close();

  // Report
  const lines = [`pageerrors: ${errors.length}`];
  for (const e of errors) lines.push('  ! ' + e.split('\n')[0]);
  for (const [name, rep] of log) {
    if (typeof rep === 'string') { lines.push(`${name}: ${rep}`); continue; }
    lines.push(`\n### ${name}  winW=${rep.winW} docW=${rep.docW} hScroll=${rep.hasHScroll}`);
    for (const o of rep.offenders) lines.push(`   right=${o.right} <${o.tag} class="${o.cls}"> "${o.text}"`);
  }
  const out = lines.join('\n');
  fs.writeFileSync(path.join(OUT, 'report.txt'), out + '\n');
  console.log(out);
}

main().catch((e) => { console.error(e); process.exit(1); });
