/// <reference path="../../support/index.d.ts" />

// auth-admin-bypasses-setup-gate
// ──────────────────────────────
// P0 permission test: an admin user (roles=["admin"], no "lecturer"/"teacher")
// who has NO OpenStack projects configured must NOT be trapped in /setup. The
// admin lands on /dashboard and can navigate to /admin.
//
// Why this test exists
//   App.tsx lines 50-66 implement the project-bootstrap effect. For non-lecturer
//   users (admins), the effect short-circuits:
//     - sets activeProject = null
//     - sets projectsChecked = true
//     - NEVER calls listOpenstackProjects()
//   That makes `needsSetup = isLecturer && activeProject === null` evaluate to
//   `false && null` → false, so App.tsx falls through to the main <Routes>
//   block at line 145 and the admin can use the app.
//
//   If this short-circuit ever regresses (e.g. someone removes the early-
//   return, or the role check is flipped), every admin without a personal
//   OpenStack project gets redirected into /setup — which is a flow built for
//   lecturers and which the admin has no business completing. The app becomes
//   un-administrable, silently.
//
//   We pin two invariants:
//     1. /dashboard renders normally for the admin (URL + Dashboard heading).
//     2. listOpenstackProjects() is NEVER called for the admin — proof that
//        the non-lecturer branch of the effect actually ran.
//     3. /admin is reachable and AdminMonitoring renders.

describe("Auth · admin bypasses the OpenStack setup gate", () => {
  beforeEach(() => {
    // Standard defaults — admin's path won't hit getProjects, but other
    // endpoints (deployments, templates, template-versions, courses,
    // keycloak-groups, flavors) ARE fired by AdminMonitoring on mount.
    cy.mockApi();
    // Override the projects intercept with an empty fixture and a dedicated
    // alias. If anything regresses and the admin DOES fetch projects, this
    // intercept catches it — and the assertion below will fail.
    cy.intercept("GET", "/api/v1/openstack-projects*", {
      fixture: "openstack-projects/empty.json",
    }).as("getProjectsEmpty");
  });

  it("renders /dashboard without calling listOpenstackProjects and lets /admin load", () => {
    cy.loginAs("admin", "/dashboard");

    // Final URL must be /dashboard — no redirect to /setup. The admin is past
    // both the project-check gate (resolved synchronously by the non-lecturer
    // branch of the effect) and the needsSetup gate (false for non-lecturers).
    cy.url().should("include", "/dashboard");
    cy.location("pathname").should("eq", "/dashboard");

    // Dashboard heading from Dashboard.tsx line 167 — unconditional, stable
    // anchor, present even before quotas/deployments resolve.
    cy.contains("h1", "Dashboard").should("be.visible");

    // The loading screen ("Laden…") rendered while projectsChecked is false
    // must not be on the page anymore.
    cy.contains("Laden…").should("not.exist");

    // Load-bearing assertion for the admin short-circuit: the non-lecturer
    // branch of the App.tsx effect must NEVER call listOpenstackProjects().
    // If somebody removes the early-return, this intercept would fire and the
    // length assertion would flip from 0 to 1.
    cy.get("@getProjectsEmpty.all").should("have.length", 0);

    // Now verify /admin is reachable. We re-issue cy.loginAs so the Keycloak
    // stub is re-installed via onBeforeLoad before the bundle re-evaluates on
    // the fresh page load — a bare cy.visit would let the real keycloak-js
    // module run and stall on its network init.
    cy.loginAs("admin", "/admin");
    cy.url().should("include", "/admin");
    cy.location("pathname").should("eq", "/admin");

    // AdminMonitoring.tsx renders <h1>Administration</h1> at the top of the
    // page (line 395) — unconditional, present before any fetched data
    // resolves. Good stable anchor.
    cy.contains("h1", "Administration").should("be.visible");

    // Still no project fetch — admin remains short-circuited across both
    // route visits.
    cy.get("@getProjectsEmpty.all").should("have.length", 0);
  });
});
