/// <reference path="../../support/index.d.ts" />

// setup-form-submit-creates-project
// ─────────────────────────────────
// P0 success-path test: a lecturer who has no OpenStack project lands on the
// /setup gate, fills out the form-tab of OpenStackSetup, clicks "Zugangsdaten
// speichern & fortfahren", and the app must:
//   1. POST /api/v1/openstack-projects with exactly the typed credentials.
//   2. Re-fetch listOpenstackProjects() via the onSuccess callback that
//      App.tsx wires up (refreshActiveProject, App.tsx lines 74-78).
//   3. Once the refetch returns a project, the needsSetup gate must open and
//      the main routes must mount — meaning the URL ends up on /dashboard.
//
// Why this test exists
//   This is the entire onboarding hand-off. The setup page is the only path
//   for a fresh lecturer to leave /setup. If any link in the chain breaks:
//     - createOpenstackProject payload shape regresses → backend 422, user
//       stuck with a red error banner.
//     - onSuccess prop is wired wrong (e.g. someone replaces it with a hard
//       navigate("/dashboard")) → App.tsx never re-runs the project check,
//       activeProject stays null, the needsSetup gate immediately rewrites
//       the URL back to /setup. The lecturer ping-pongs forever.
//     - refetch returns empty / errors → gate stays closed, user stranded.
//   We pin all three transitions in one happy-path flow.
//
// How the GET-state switch works
//   App.tsx fires listOpenstackProjects() twice:
//     a) on first authentication → empty.json (drives the user into /setup).
//     b) after onSuccess in OpenStackSetup → must now return a project so
//        needsSetup flips to false and main routes render.
//   We can't keep the same intercept for both — they need different payloads.
//   Cypress evaluates intercepts in reverse-registration order, so we register
//   the "empty" intercept first, then *replace* it with the "single project"
//   intercept right before clicking Save. From that click onward, every GET
//   to /api/v1/openstack-projects* hits the new intercept.

describe("Setup · form submit creates project, refetch flips gate, lands on /dashboard", () => {
  beforeEach(() => {
    // mockApi registers the standard aliases. The default getProjects
    // intercept returns single.json (lecturer has a project). We override it
    // below with empty.json so the lecturer starts trapped in /setup.
    cy.mockApi();
    cy.intercept("GET", "/api/v1/openstack-projects*", {
      fixture: "openstack-projects/empty.json",
    }).as("getProjectsEmpty");

    // POST intercept — the form submit must hit this. 201 + the freshly
    // created project as response (mirrors backend createOpenstackProject
    // response shape: OpenstackCredentialsResponse).
    cy.intercept("POST", "/api/v1/openstack-projects", {
      statusCode: 201,
      fixture: "openstack-projects/created.json",
    }).as("createProject");
  });

  it("POSTs typed credentials, refetches, opens the gate to /dashboard", () => {
    cy.loginAs("lecturer", "/dashboard");

    // First bootstrap fetch resolves with empty.json → needsSetup = true →
    // wildcard route rewrites /dashboard to /setup.
    cy.wait("@getProjectsEmpty");
    cy.location("pathname").should("eq", "/setup");
    cy.contains("OpenStack einrichten").should("be.visible");

    // OpenStackSetup defaults to the YAML tab. Switch to the Form tab — the
    // form fields below only mount in this tab. The toggle button is labeled
    // "Formular" (OpenStackSetup.tsx line 150).
    cy.contains("button", "Formular").click();

    // Fill all required fields. Labels match OpenStackSetup.tsx (lines 193-
    // 285). We use findByLabelText-style lookup via the htmlFor attribute on
    // each Label, which targets the actual Input by id.
    const creds = {
      auth_url: "https://openstack.example.com:5000/v3",
      openstack_project_id: "ks-uuid-new",
      openstack_project_name: "NeuesProjekt",
      region_name: "RegionOne",
      user_domain_name: "Default",
      username: "lec1",
      password: "geheim",
    };

    cy.get("#auth_url").clear().type(creds.auth_url);
    cy.get("#openstack_project_id").type(creds.openstack_project_id);
    cy.get("#openstack_project_name").type(creds.openstack_project_name);
    cy.get("#region_name").clear().type(creds.region_name);
    cy.get("#user_domain_name").clear().type(creds.user_domain_name);
    cy.get("#username").type(creds.username);
    cy.get("#password").type(creds.password);

    // Swap the GET intercept BEFORE clicking submit. From this moment on,
    // every /api/v1/openstack-projects GET (specifically the one fired by
    // refreshActiveProject in App.tsx) returns one project — flipping
    // needsSetup to false and unmounting the /setup gate.
    cy.intercept("GET", "/api/v1/openstack-projects*", {
      fixture: "openstack-projects/single.json",
    }).as("getProjectsSingle");

    cy.contains("button", "Zugangsdaten speichern & fortfahren").click();

    // 1) POST fired with exactly the typed payload. createOpenstackProject
    // sends the form as JSON body (openstackProjects.ts line 51). We assert
    // the full payload shape so a regression in the payload mapping (e.g.
    // dropping user_domain_name) trips this test.
    cy.wait("@createProject").its("request.body").should("deep.equal", creds);

    // 2) onSuccess (refreshActiveProject) triggers a refetch — must hit the
    // new intercept and return the single project.
    cy.wait("@getProjectsSingle");

    // 3) needsSetup flips to false → main routes mount → "/" inside the
    // authenticated tree is already /dashboard, but we came in via /dashboard
    // initially and the URL was rewritten to /setup. Once the gate opens,
    // App.tsx's /setup route (line 152) does <Navigate to="/dashboard">.
    cy.location("pathname").should("eq", "/dashboard");
    cy.contains("h1", "Dashboard").should("be.visible");
  });
});
