/// <reference path="../../support/index.d.ts" />

// dashboard-renders-deployments-and-quotas
// ────────────────────────────────────────
// P0 success-path test: after a lecturer lands on /dashboard, the page must
// render BOTH data sources — the deployments list (Dashboard.tsx fetches
// getAllDeployments(activeProjectId)) AND the resource-quota stats (getQuotas()).
//
// Why this test exists
//   Dashboard.tsx is the lecturer's landing page. Two independent network
//   fetches feed it: /api/v1/deployments and /api/v1/quotas. If either fetch
//   or its render path regresses, the user lands on an empty/half-empty main
//   page after login. Asserting both data flows in one spec pins the primary
//   landing surface end to end.
//
// Fixture notes
//   - deployments/list-3.json wraps three DeploymentDto rows in the envelope
//     ({ success, data, pagination, errors, timestamp, request_id }) that
//     getAllDeployments() unwraps via the "data" check in src/api/deployments.ts.
//   - Statuses are varied (running / deploying / failed) so any
//     getStatusBadge() regression on a non-default branch surfaces in DOM.
//   - quotas use the default mockApi fixture (compute.cores.used=32/limit=64,
//     volume.gigabytes.used=100/limit=1000, compute.instances.used=2/limit=20).
//     These render into the stats cards as plain text ("32/64", "2/20",
//     "100 GB / 1000 GB") — the Dashboard.tsx version shipped does not draw
//     visible Progress bars for quotas, the numbers themselves are the
//     user-visible quota signal.

describe("Dashboard · renders deployments and quotas", () => {
  beforeEach(() => {
    // mockApi gives us a non-empty openstack-projects/single.json (gets the
    // lecturer past App.tsx's project gate) plus the default quotas/default
    // fixture. We then override deployments with a 3-row list AFTER mockApi
    // so the later registration wins on the Cypress intercept stack.
    cy.mockApi();
    cy.intercept("GET", /\/api\/v1\/deployments(\?[^/]*)?$/, {
      fixture: "deployments/list-3.json",
    }).as("getDeploymentsList");
    cy.intercept("GET", "/api/v1/quotas*", {
      fixture: "quotas/default.json",
    }).as("getQuotasWithUsage");
  });

  it("shows three deployment rows and quota usage numbers", () => {
    cy.loginAs("lecturer", "/dashboard");

    // Block until BOTH fetches that drive Dashboard.tsx have fired. This
    // doubles as proof that getAllDeployments and getQuotas were actually
    // called (no arbitrary timer needed).
    cy.wait(["@getDeploymentsList", "@getQuotasWithUsage"]);

    // ── Deployments ────────────────────────────────────────────────────────
    // Section heading is unconditional inside the "Kürzliche Deployments"
    // card — good anchor to prove the list section rendered at all.
    cy.contains("Kürzliche Deployments").should("be.visible");

    // Each fixture row's name must end up in the DOM. Asserting all three
    // catches any regression that silently truncates / filters the list.
    cy.contains("test-deploy-alpha").should("be.visible");
    cy.contains("test-deploy-beta").should("be.visible");
    cy.contains("test-deploy-gamma").should("be.visible");

    // Status badges. Dashboard.tsx maps status → German label:
    //   running   → "Läuft"
    //   deploying → "Wird bereitgestellt"
    //   failed    → falls through to the default <Badge>{status}</Badge>,
    //               so the raw "failed" string is rendered.
    // Hitting all three badge branches in one spec means any
    // getStatusBadge() change surfaces here, not just on the happy path.
    cy.contains("Läuft").should("be.visible");
    cy.contains("Wird bereitgestellt").should("be.visible");
    cy.contains("failed").should("be.visible");

    // ── Quota stats ────────────────────────────────────────────────────────
    // Stat-card labels are unconditional once quotas resolve. Pinning the
    // German labels guards against i18n drift in the dashboard cards.
    cy.contains("Aktive Deployments").should("be.visible");
    cy.contains("Verwendete CPU-Kerne").should("be.visible");
    cy.contains("Genutzter Speicher").should("be.visible");
    cy.contains("Aktive VMs").should("be.visible");

    // The active-deployments stat is computed from the list length (not from
    // a separate API field). Three rows in → "3" rendered.
    cy.contains("Aktive Deployments")
      .parent()
      .should("contain.text", "3");

    // Quota numbers from quotas/default.json. Asserting the exact "used/limit"
    // strings proves the data made it through the QuotasResponse unwrap AND
    // through Dashboard.tsx's template literal — a regression in either step
    // would show "—" or "Lädt..." instead.
    cy.contains("32/64").should("be.visible"); // compute.cores.used/limit
    cy.contains("2/20").should("be.visible");  // compute.instances.used/limit
    cy.contains("100 GB / 1000 GB").should("be.visible"); // volume.gigabytes

    // Sanity: we are NOT stuck in the loading state. "Lädt..." is the
    // placeholder string rendered while either fetch is pending. After
    // both waits above resolve and the values appear, it must be gone.
    cy.contains("Lädt...").should("not.exist");
  });
});
