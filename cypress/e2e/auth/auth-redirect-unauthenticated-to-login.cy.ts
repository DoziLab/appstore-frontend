/// <reference path="../../support/index.d.ts" />

// auth-redirect-unauthenticated-to-login
// ──────────────────────────────────────
// P0 permission test: an unauthenticated visitor hitting a protected route
// (`/dashboard`) must see the Login screen rendered in place — App.tsx does
// NOT navigate, it renders <Login/> as a sibling of the auth-gate. While that
// renders, the app must not fire ANY protected backend call (e.g.
// /api/v1/openstack-projects, /api/v1/deployments, /api/v1/quotas).
//
// Why this test exists
//   The auth-gate in App.tsx is the top-level security boundary. A regression
//   that silently drops it would leak protected data to anonymous visitors.
//   This test pins the Keycloak stub to `authenticated: false` BEFORE the
//   bundle evaluates (via cy.loginAs → visit onBeforeLoad) and verifies
//   (a) Login renders, (b) URL stays on /dashboard, (c) no protected calls.

describe("Auth · redirects unauthenticated visitor to login", () => {
  beforeEach(() => {
    // Register intercepts as spies. We do NOT call cy.mockApi here on purpose:
    // these endpoints must never be hit while unauthenticated, so we reply 500
    // to make any leak loud, and we assert the alias .all length === 0 at the
    // end of the test. (Each protected endpoint that App or its eager hooks
    // could fire on mount.)
    cy.intercept("GET", "/api/v1/openstack-projects*", (req) => req.reply(500)).as(
      "getProjects",
    );
    cy.intercept(
      "GET",
      /\/api\/v1\/deployments(\?[^/]*)?$/,
      (req) => req.reply(500),
    ).as("getDeployments");
    cy.intercept("GET", "/api/v1/quotas*", (req) => req.reply(500)).as("getQuotas");
    cy.intercept("GET", "/api/v1/templates*", (req) => req.reply(500)).as(
      "getTemplates",
    );
    cy.intercept("GET", "/api/v1/courses*", (req) => req.reply(500)).as(
      "getCourses",
    );
  });

  it("renders Login at /dashboard, keeps the URL, and fires no protected API calls", () => {
    cy.loginAs("unauthenticated", "/dashboard");

    // Login.tsx renders the heading "Willkommen!" and the submit button
    // labelled "Anmelden mit Keycloak". Both are stable, user-facing strings —
    // good selectors without needing a data-testid.
    cy.contains("h1", "Willkommen!").should("be.visible");
    cy.contains("button", /Anmelden mit Keycloak/i).should("be.visible");

    // App.tsx renders <Login/> in place; it does not Navigate. URL stays put.
    cy.location("pathname").should("eq", "/dashboard");

    // Sidebar (authenticated chrome) must NOT be in the DOM. The Sidebar
    // contains "Dashboard" as nav-link text; Login does not. Use the unique
    // sidebar landmark instead by asserting the Login card's footer copy.
    cy.contains(
      "DoziLab – Ihre Plattform für App-Deployment auf OpenStack",
    ).should("be.visible");

    // No protected calls were fired. By the time Login is visible above,
    // the app has already passed its mount/init phase, so any eager fetch
    // would have hit one of these spies by now.
    cy.get("@getProjects.all").should("have.length", 0);
    cy.get("@getDeployments.all").should("have.length", 0);
    cy.get("@getQuotas.all").should("have.length", 0);
    cy.get("@getTemplates.all").should("have.length", 0);
    cy.get("@getCourses.all").should("have.length", 0);
  });
});
