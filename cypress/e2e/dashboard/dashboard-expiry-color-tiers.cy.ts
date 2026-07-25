/// <reference path="../../support/index.d.ts" />

// dashboard-expiry-color-tiers
// ────────────────────────────
// P2 state test for the #180 expiry indicator on the Dashboard. Each recent
// deployment row runs its `expires_at` through getExpiryState() (see
// src/utils/deployment.ts) and renders an icon ONLY for warning/critical/
// expired — never for "ok" (far from expiry). This spec pins all four tiers.
//
// getExpiryState() thresholds, relative to Date.now():
//   remaining <= 0        → "expired"   (AlertOctagon, red;   title "Wird in Kürze automatisch gelöscht")
//   remaining <= 42 days  → "critical"  (AlertTriangle, red;  title "Läuft bald ab — am <date>")
//   remaining <= 90 days  → "warning"   (AlertTriangle, amber;title "Läuft am <date> ab")
//   otherwise             → "ok"        (no icon at all)
//
// Determinism
//   The thresholds compare against Date.now(), so we do NOT freeze the clock
//   (cy.clock can stall React/vite timers). Instead each row's expires_at is
//   built relative to the real "now" at run time — +180d (ok), +60d (warning),
//   +10d (critical), −5d (expired) — so the tiers stay correct on any day.
//
// Tier-distinguishing selectors
//   - Row scope: cy.contains('p', <name>).parent() → the `.flex.items-center.gap-3`
//     div that holds the name, status badge and (maybe) the expiry <span title>.
//   - "ok" row: that scope has NO svg.text-amber-500 / svg.text-red-500.
//   - warning: svg.text-amber-500 + title "Läuft am <date> ab".
//   - critical: svg.text-red-500  + title "Läuft bald ab — am <date>".
//   - expired: svg.text-red-500   + title "Wird in Kürze automatisch gelöscht".
//   Warning vs critical share the AlertTriangle glyph but differ by colour
//   class AND title copy — we assert both so a mix-up in either surfaces.

const DAY = 24 * 60 * 60 * 1000;

// German date label exactly as Dashboard.tsx renders it via
// toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }).
function deLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function deploymentRow(
  id: string,
  name: string,
  expiresAt: string,
) {
  return {
    id,
    name,
    template_version_id: `tv-${id}`,
    course_id: `course-${id}`,
    deployment_mode: "single",
    status: "running",
    openstack_stack_id: `stack-${id}`,
    config_json: null,
    deployment_parameters: null,
    access_types_json: "[]",
    expires_at: expiresAt,
    expiry_warning_at: expiresAt,
    created_at: "2026-06-20T10:00:00Z",
    updated_at: "2026-06-26T10:00:00Z",
    template_version: {
      id: `tv-${id}`,
      version: "1.0.0",
      template_id: `tpl-${id}`,
      template_name: `Template ${id}`,
    },
    course: {
      id: `course-${id}`,
      name: `Kurs ${id}`,
      lecturer_id: "user-lec-1",
    },
    instances: [],
  };
}

describe("Dashboard · expiry colour tiers", () => {
  it("shows the correct expiry indicator per tier and none when far from expiry", () => {
    const now = Date.now();
    const okIso = new Date(now + 180 * DAY).toISOString();
    const warnIso = new Date(now + 60 * DAY).toISOString();
    const critIso = new Date(now + 10 * DAY).toISOString();
    const expiredIso = new Date(now - 5 * DAY).toISOString();

    const body = {
      success: true,
      message: "ok",
      data: [
        deploymentRow("ok01", "deploy-ok", okIso),
        deploymentRow("warn02", "deploy-warning", warnIso),
        deploymentRow("crit03", "deploy-critical", critIso),
        deploymentRow("exp04", "deploy-expired", expiredIso),
      ],
      pagination: { page: 1, page_size: 20, total_items: 4, total_pages: 1 },
      errors: null,
      timestamp: new Date(now).toISOString(),
      request_id: "req-expiry-tiers",
    };

    cy.mockApi();
    // Override the deployments list AFTER mockApi so this registration wins on
    // the intercept stack (later-registered intercepts take precedence).
    cy.intercept("GET", /\/api\/v1\/deployments(\?[^/]*)?$/, { body }).as(
      "getDeployments",
    );

    cy.loginAs("lecturer", "/dashboard");
    cy.wait("@getDeployments");

    // All four rows rendered (anchors the section + proves the list mapped).
    cy.contains("Kürzliche Deployments").should("be.visible");
    cy.contains("p", "deploy-ok").should("be.visible");
    cy.contains("p", "deploy-warning").should("be.visible");
    cy.contains("p", "deploy-critical").should("be.visible");
    cy.contains("p", "deploy-expired").should("be.visible");

    // ── ok (>90d out): NO expiry icon at all ────────────────────────────────
    cy.contains("p", "deploy-ok")
      .parent()
      .within(() => {
        cy.get("svg.text-amber-500").should("not.exist");
        cy.get("svg.text-red-500").should("not.exist");
        cy.get('[title*="Läuft"]').should("not.exist");
      });

    // ── warning (≤90d, >42d): amber AlertTriangle + "Läuft am <date> ab" ────
    cy.contains("p", "deploy-warning")
      .parent()
      .within(() => {
        cy.get("svg.text-amber-500").should("exist");
        cy.get("svg.text-red-500").should("not.exist");
        cy.get(`[title="Läuft am ${deLabel(warnIso)} ab"]`).should("exist");
      });

    // ── critical (≤42d, >0): red AlertTriangle + "Läuft bald ab — am <date>" ─
    cy.contains("p", "deploy-critical")
      .parent()
      .within(() => {
        cy.get("svg.text-red-500").should("exist");
        cy.get("svg.text-amber-500").should("not.exist");
        cy.get(`[title="Läuft bald ab — am ${deLabel(critIso)}"]`).should(
          "exist",
        );
      });

    // ── expired (past): red AlertOctagon + fixed deletion notice ────────────
    cy.contains("p", "deploy-expired")
      .parent()
      .within(() => {
        cy.get("svg.text-red-500").should("exist");
        cy.get("svg.text-amber-500").should("not.exist");
        cy.get('[title="Wird in Kürze automatisch gelöscht"]').should("exist");
      });
  });
});
