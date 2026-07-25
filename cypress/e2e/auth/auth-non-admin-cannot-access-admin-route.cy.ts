/// <reference path="../../support/index.d.ts" />

// auth-non-admin-cannot-access-admin-route
// ────────────────────────────────────────
// P0 permission test: a lecturer (roles=["lecturer"], NOT "admin") navigating
// directly to an admin route (/admin/templates) must be redirected away and
// must NOT see any admin page contents or trigger admin-only data fetches.
//
// History
//   When this test was first written the app had NO route-level role gate:
//   AdminMonitoring was wired at /admin for any authenticated user, so a
//   lecturer who knew the URL got the full admin UI. That was recorded as a
//   privilege-escalation finding in cypress/SECURITY-FINDINGS.md and the test
//   was left as describe.skip.
//
//   The staging rework FIXED it: admin pages now live at /admin/projects,
//   /admin/templates and /admin/lecturers, each wrapped in
//   <ProtectedRoute requireAdmin> (src/components/ProtectedRoute.tsx). For a
//   non-admin, requireAdmin && !isAdmin → <Navigate to="/dashboard" replace>.
//   The component never mounts, so its data effects never run. This test is
//   now un-skipped and pins that guard.
//
//   We pin three invariants for a lecturer hitting /admin/templates:
//     1. The browser is redirected to /dashboard (ProtectedRoute guard fired).
//     2. The AdminTemplateApprovals "Template-Freigaben" H1 is NOT in the DOM.
//     3. The admin-only approval-queue fetch (GET /template-versions/queue)
//        NEVER fires — proof the page short-circuited before its effects ran.
//
//   If any of these regress, the requireAdmin guard has been removed or
//   weakened and lecturers regain access to the admin surface — a
//   privilege-escalation regression.

describe("Auth · non-admin lecturer cannot access an admin route", () => {
  beforeEach(() => {
    // Defaults satisfy App.tsx's bootstrap: lecturer has a project (single.json),
    // so needsSetup === false and the router evaluates the real route tree
    // (including the ProtectedRoute guards) instead of the /setup gate.
    cy.mockApi();

    // Dedicated alias for the admin-only approval-queue endpoint. If the guard
    // regresses and AdminTemplateApprovals mounts, its loadQueue() effect would
    // hit this — and the length-0 assertion below would flip.
    cy.intercept("GET", /\/api\/v1\/template-versions\/queue(\?.*)?$/, {
      fixture: "template-versions/queue-pending.json",
    }).as("getQueuePending");
  });

  it("redirects a lecturer off /admin/templates to /dashboard without mounting the admin page", () => {
    cy.loginAs("lecturer", "/admin/templates");

    // Bootstrap project-check resolves first (lecturer path fetches projects).
    cy.wait("@getProjects");

    // Invariant #1 — ProtectedRoute requireAdmin bounces the lecturer to
    // /dashboard. Cypress retries until the redirect settles, so no fixed wait.
    cy.location("pathname").should("eq", "/dashboard");

    // The dashboard actually rendered (we landed somewhere real, not a blank).
    cy.contains("h1", "Dashboard").should("be.visible");

    // Invariant #2 — the AdminTemplateApprovals "Template-Freigaben" H1 must
    // never be in the DOM for a lecturer. .should("not.exist") because the
    // guard redirects rather than CSS-hiding.
    cy.contains(/^Template-Freigaben$/).should("not.exist");

    // Invariant #3 — load-bearing: the admin-only approval-queue fetch MUST
    // NOT fire. If the guard let the component mount, loadQueue() would hit
    // @getQueuePending. Zero calls proves the redirect happened before mount.
    cy.get("@getQueuePending.all").should("have.length", 0);
  });
});
