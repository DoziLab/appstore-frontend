/// <reference path="../../support/index.d.ts" />

// auth-authenticated-lands-on-dashboard
// ─────────────────────────────────────
// P0 success-path test: an authenticated lecturer who already has one active
// OpenStack project visits "/" and must end up on /dashboard with the Dashboard
// view actually rendered (not stuck on the "Laden…" project-check screen, not
// pushed into /setup).
//
// Why this test exists
//   App.tsx wires three gates that all have to pass cleanly for the main path:
//     1. Keycloak `initialized && authenticated` (ReactKeycloakProvider).
//     2. `projectsChecked === true` after listOpenstackProjects() resolves.
//     3. `needsSetup === false` because the lecturer has ≥1 project.
//   Only then does <Routes> mount, which turns "/" into <Navigate to="/dashboard">.
//   Any regression in that bootstrap (e.g. project-check never resolves, or the
//   redirect chain breaks) traps every lecturer either on the loading screen or
//   in /setup. This test pins that flow end to end.

describe("Auth · authenticated lecturer lands on dashboard", () => {
  beforeEach(() => {
    // Defaults: getProjects → openstack-projects/single.json (non-empty list).
    // This satisfies App.tsx's project-check gate so we go past `needsSetup`.
    // Quotas and deployments use the standard mockApi fixtures — Dashboard
    // fires both on mount; without intercepts they'd hit the real backend.
    cy.mockApi();
  });

  it("redirects '/' to '/dashboard' and renders the Dashboard view", () => {
    cy.loginAs("lecturer", "/");

    // App.tsx must have fired listOpenstackProjects() before the routing gate
    // resolves. Waiting on the alias blocks until the request hits the
    // intercept, which doubles as proof that the project-bootstrap ran (no
    // need for arbitrary cy.wait timers).
    cy.wait("@getProjects");

    // App.tsx: <Route path="/" element={<Navigate to="/dashboard" replace />} />
    cy.url().should("include", "/dashboard");
    cy.location("pathname").should("eq", "/dashboard");

    // Dashboard heading is rendered unconditionally at the top of Dashboard.tsx
    // (line 167: <h1>Dashboard</h1>) — present whether the quota / deployments
    // fetches are still loading or already resolved. Good stable anchor.
    cy.contains("h1", "Dashboard").should("be.visible");

    // Subtitle paragraph below the heading — also unconditional, also
    // user-facing. A second anchor makes accidental matches against e.g. the
    // sidebar nav-link "Dashboard" impossible.
    cy.contains(
      "Übersicht über Ihre bereitgestellten Anwendungen und Ressourcennutzung",
    ).should("be.visible");

    // We must NOT be stuck on the loading screen anymore. App.tsx renders
    // "Laden…" while projectsChecked is false. If that text is still on the
    // page after we asserted the heading above, something rendered both.
    cy.contains("Laden…").should("not.exist");
  });
});
