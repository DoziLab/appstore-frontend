/// <reference path="../../support/index.d.ts" />

// auth-lecturer-without-project-trapped-in-setup
// ──────────────────────────────────────────────
// P0 permission test: a lecturer who is authenticated but has no OpenStack
// project must be wildcard-redirected into /setup, regardless of which URL
// they try to reach. No other protected endpoints (quotas, deployments, …)
// may be called while the setup gate is closed.
//
// Why this test exists
//   App.tsx lines 136-143 implement the needsSetup gate:
//     needsSetup = isLecturer && activeProject === null
//   When true, App.tsx renders ONLY a <Routes> tree containing /setup plus a
//   "*" wildcard that <Navigate>s every other path to /setup. If this gate
//   ever breaks silently (e.g. the project-check race resolves wrong, the
//   wildcard route is removed, or some protected page leaks through), every
//   first-time lecturer would land on an authenticated route without a
//   project_id — backend would return 403 across the board and the entire
//   onboarding flow would be dead.
//
//   We pin three invariants:
//     1. /dashboard is rewritten to /setup (URL + visible component).
//     2. /appstore is also rewritten to /setup (wildcard, not just a
//        per-route redirect).
//     3. quotas and deployments are NEVER fetched — the gate must short-
//        circuit BEFORE the authenticated routes mount their effects.

describe("Auth · lecturer without OpenStack project is trapped in /setup", () => {
  beforeEach(() => {
    // mockApi registers the standard aliases (getProjects, getQuotas,
    // getDeployments, …). We then override getProjects with the empty
    // fixture so the project-check resolves to []. Later intercepts win in
    // Cypress, so this override beats the single.json default.
    cy.mockApi();
    cy.intercept("GET", "/api/v1/openstack-projects*", {
      fixture: "openstack-projects/empty.json",
    }).as("getEmptyProjects");
  });

  it("redirects /dashboard and /appstore to /setup and skips other API calls", () => {
    cy.loginAs("lecturer", "/dashboard");

    // Wait for the bootstrap project-check to finish; this gates the gate.
    // Without this, we'd race the routing logic and assert on a state where
    // App.tsx is still showing "Laden…".
    cy.wait("@getEmptyProjects");

    // App.tsx renders <Navigate to="/setup" replace> for the wildcard, which
    // updates the browser URL. We assert on the final pathname.
    cy.url().should("match", /\/setup$/);
    cy.location("pathname").should("eq", "/setup");

    // OpenStackSetup.tsx renders a CardTitle "OpenStack einrichten" — stable
    // anchor at the top of the page, present unconditionally.
    cy.contains("OpenStack einrichten").should("be.visible");
    // Second anchor: the description below it. Two assertions guarantee we
    // aren't matching the sidebar nav (sidebar isn't rendered in the
    // needsSetup branch anyway, but belt + braces).
    cy.contains(
      "Geben Sie Ihre Zugangsdaten ein oder fügen Sie eine clouds.yaml ein",
    ).should("be.visible");

    // Visit a different protected route directly — the wildcard must catch
    // it too. This is the load-bearing assertion for the "*" route in the
    // needsSetup branch of App.tsx. We re-use cy.loginAs so the Keycloak
    // stub is re-installed via onBeforeLoad before the bundle re-evaluates
    // on the fresh page load (a bare cy.visit would let the real keycloak-js
    // module run and stall on its network init).
    cy.loginAs("lecturer", "/appstore");
    cy.wait("@getEmptyProjects");
    cy.url().should("match", /\/setup$/);
    cy.location("pathname").should("eq", "/setup");
    cy.contains("OpenStack einrichten").should("be.visible");

    // The setup gate must short-circuit BEFORE any authenticated page mounts
    // its data effects. If quotas or deployments were fetched, that would
    // mean a protected component briefly rendered — exactly the regression
    // we're guarding against.
    cy.expectNoRequest("getQuotas");
    cy.expectNoRequest("getDeployments");
  });
});
