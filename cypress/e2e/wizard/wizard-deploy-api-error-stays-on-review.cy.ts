/// <reference path="../../support/index.d.ts" />

// wizard-deploy-api-error-stays-on-review
// ───────────────────────────────────────
// P0 error-path companion to `wizard-full-flow-to-deploy-success`.
//
// Why this test exists
//   The wizard's submit hits POST /api/v1/deployments. If that fails server-
//   side (500 / OpenStack quota outage / DB outage / …), the user has just
//   spent minutes filling in name, course, groups, runtime, parameters — and
//   in some cases re-uploaded files. A silent navigation away from the
//   wizard, or any state reset that throws those inputs on the floor, would
//   force them to start the entire flow over without knowing why their last
//   attempt died. That's the single biggest UX cliff on the most important
//   action in the app.
//
//   handleDeploy() in DeploymentWizard.tsx catches the apiFetch rejection,
//   sets the local `error` state with the thrown message, and crucially
//   does NOT call `onComplete`. The wizard's render guard then surfaces the
//   error inline (`Fehler beim Laden`) without unmounting the route — so
//   the URL stays at /deploy/<templateId> and a "Neu laden" affordance is
//   offered. That contract is what this test pins.
//
// What's asserted
//   - POST /api/v1/deployments fires (the wizard actually attempted submit,
//     so we're testing the real error branch and not a validation early
//     return).
//   - URL stays on /deploy/tpl-wp-0001 — no onComplete navigation to
//     /deployment/<id> on failure.
//   - A user-visible error indication is present (matches /fehler/i; the
//     wizard surfaces apiFetch's thrown message inside its error view).
//
// Setup mirrors the success spec exactly except for the POST intercept,
// which is flipped to 500 with the shared errors/500.json fixture.

describe("DeploymentWizard · Deploy API error stays on review", () => {
  beforeEach(() => {
    cy.mockApi();

    // Same template/version/group fixtures as the success spec — the
    // wizard must reach the overview step before we can click
    // "Anwendung deployen", and that requires identical mount data.
    cy.intercept("GET", "/api/v1/templates/tpl-wp-0001", {
      fixture: "templates/detail-wordpress.json",
    }).as("getTemplateDetail");
    cy.intercept(
      "GET",
      "/api/v1/template-versions/template/tpl-wp-0001*",
      { fixture: "template-versions/list-wordpress.json" },
    ).as("getTemplateVersionsForTemplate");
    cy.intercept(
      "GET",
      "/api/v1/template-versions/tv-wp-1*",
      { fixture: "template-versions/version-detail-wordpress.json" },
    ).as("getTemplateVersionDetail");

    cy.intercept("GET", "**/admin/realms/*/groups*", {
      fixture: "keycloak/groups-direct.json",
    }).as("getKeycloakGroupsDirect");
    cy.intercept("GET", "**/admin/realms/*/groups/*/members*", {
      body: [
        {
          id: "stu-1",
          username: "stud1",
          email: "stud1@dhbw.de",
          firstName: "Stu",
          lastName: "Dent",
          enabled: true,
          emailVerified: true,
        },
      ],
    }).as("getKeycloakGroupMembers");

    // The only divergence from the success spec: server returns 500.
    // apiFetch reads the JSON body and throws `Error("Internal Server
    // Error")` (errors/500.json sets `detail: "Internal Server Error"`),
    // which handleDeploy() catches and pipes into the wizard's error
    // state via setError(err.message).
    cy.intercept(
      "POST",
      "/api/v1/deployments",
      { statusCode: 500, fixture: "errors/500.json" },
    ).as("createDeploymentFail");
  });

  it("on POST /api/v1/deployments 500: stays on /deploy/<id>, shows an error, does NOT navigate to /deployment/<id>", () => {
    cy.loginAs("lecturer", "/deploy/tpl-wp-0001");

    cy.wait("@getTemplateDetail");
    cy.wait("@getTemplateVersionsForTemplate");
    cy.contains("Template & Zugriff").should("be.visible");

    // Fill step 0 with valid data — same path the success spec takes,
    // so we exercise the real submit branch (not a validation guard).
    cy.get("#deployment-name").clear().type("test-deploy-error-path");
    cy.get("#deployment-name").should("have.value", "test-deploy-error-path");

    cy.wait("@getKeycloakGroupsDirect");
    cy.contains("label", /Kurs auswählen/i)
      .parent()
      .find('[role="combobox"]')
      .click();
    cy.get('[role="option"]').contains("Test-Gruppe").click();
    cy.wait("@getKeycloakGroupMembers");

    // Auto-distribute so the lone student lands in Gruppe 1 — otherwise
    // handleDeploy() would early-return on the "every group empty" check
    // and POST would never fire.
    cy.contains("button", /Auto-Verteilen/i).click();

    // Shortcut to the overview step — wordpress fixture has no
    // parameters/user_files, so this jumps straight to "Übersicht".
    cy.contains("button", "Direkt zur Übersicht")
      .should("not.be.disabled")
      .click();
    cy.contains("Deployment-Zusammenfassung").should("be.visible");

    // ── Submit, expect failure ─────────────────────────────────────────
    cy.contains("button", "Anwendung deployen").click();

    // The POST actually fires (proves we're testing the error branch
    // of the submit pipeline, not an unrelated validation skip).
    cy.wait("@createDeploymentFail")
      .its("response.statusCode")
      .should("eq", 500);

    // URL must NOT change to /deployment/<id> — onComplete navigation is
    // gated behind a successful create.
    cy.url().should("match", /\/deploy\/tpl-wp-0001$/);
    cy.url().should("not.include", "/deployment/");

    // User-visible error indication. handleDeploy pipes the thrown
    // message ("Internal Server Error") into the wizard's `error`
    // state; the render guard at the bottom of DeploymentWizard.tsx
    // surfaces it under a "Fehler beim Laden" heading, so /fehler/i
    // is the stable marker that works regardless of how the message
    // text from the backend changes.
    cy.contains(/fehler/i).should("be.visible");
  });
});
