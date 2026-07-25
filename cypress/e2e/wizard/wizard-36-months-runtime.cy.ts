/// <reference path="../../support/index.d.ts" />

// wizard-36-months-runtime
// ─────────────────────────
// P2 edge-case test for the DeploymentWizard's runtime ("Laufzeit") select.
//
// Why this test exists
//   Feat #179 added a 36-month ("3 Jahre") runtime option to the wizard.
//   The runtime lives in a Radix Select on step 0 ("Template & Zugriff",
//   DeploymentWizard.tsx ~L1233-1253), defaulting to "4" (4 Monate). On
//   submit, handleDeploy() serializes `runtime_months: parseInt(runtime, 10)`
//   into the POST /api/v1/deployments payload (~L901). Because 36 is a
//   non-default value, a regression that dropped the option or reset the
//   state would silently ship deployments with the wrong (default) runtime.
//   This test drives the full wizard exactly like
//   wizard-full-flow-to-deploy-success, but selects "3 Jahre" before
//   submitting and pins runtime_months: 36 in the POST body.
//
// What's asserted
//   - The runtime Select on step 0 offers and accepts the "3 Jahre" option.
//   - POST /api/v1/deployments carries runtime_months === 36.
//   - Navigation still reaches /deployment/<new id> (flow stays intact).

describe("DeploymentWizard · 36-month runtime (3 Jahre)", () => {
  beforeEach(() => {
    cy.mockApi();

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

    cy.intercept(
      "POST",
      "/api/v1/deployments",
      { statusCode: 201, fixture: "deployments/created.json" },
    ).as("createDeployment");

    cy.intercept(
      "GET",
      "/api/v1/deployments/dep-new-001*",
      { fixture: "deployments/detail-deploying.json" },
    ).as("getNewDeployment");
    cy.intercept(
      "GET",
      "/api/v1/deployments/*/logs*",
      { fixture: "deployments/logs-empty.json" },
    ).as("getNewDeploymentLogs");
  });

  it("selects the 3-Jahre runtime and POSTs runtime_months: 36", () => {
    cy.loginAs("lecturer", "/deploy/tpl-wp-0001");

    cy.wait("@getTemplateDetail");
    cy.wait("@getTemplateVersionsForTemplate");
    cy.contains("Template & Zugriff").should("be.visible");

    // ── Fill step 0 ────────────────────────────────────────────────────
    cy.get("#deployment-name").clear().type("test-deploy-36-months");
    cy.get("#deployment-name").should("have.value", "test-deploy-36-months");

    // ── Select the 36-month runtime ─────────────────────────────────────
    // The runtime Select lives on step 0, in the first card next to the
    // deployment name (DeploymentWizard.tsx ~L1233-1253), labeled
    // "Laufzeit" and defaulting to "4 Monate". Scope the trigger by that
    // label so we don't grab the version / course selects, then pick the
    // "3 Jahre" option from the portal.
    cy.contains("label", /Laufzeit/i)
      .parent()
      .find('[role="combobox"]')
      .click();
    cy.get('[role="option"]').contains("3 Jahre").click();
    cy.contains("label", /Laufzeit/i)
      .parent()
      .find('[role="combobox"]')
      .should("contain.text", "3 Jahre");

    // ── Pick the course group + distribute the student ──────────────────
    cy.wait("@getKeycloakGroupsDirect");
    cy.contains("label", /Kurs auswählen/i)
      .parent()
      .find('[role="combobox"]')
      .click();
    cy.get('[role="option"]').contains("Test-Gruppe").click();
    cy.wait("@getKeycloakGroupMembers");

    cy.contains("button", /Auto-Verteilen/i).click();

    // ── Shortcut to review + submit ─────────────────────────────────────
    cy.contains("button", "Direkt zur Übersicht")
      .should("not.be.disabled")
      .click();
    cy.contains("Deployment-Zusammenfassung").should("be.visible");

    cy.contains("button", "Anwendung deployen").click();

    // ── The key assertion: runtime_months made it into the payload ──────
    cy.wait("@createDeployment").then((intercept) => {
      expect(intercept.request.body).to.have.property("runtime_months", 36);
      expect(intercept.request.body).to.have.property(
        "name",
        "test-deploy-36-months",
      );
    });

    // ── Flow stays intact → navigates to the new deployment ─────────────
    cy.url().should("include", "/deployment/dep-new-001");
    cy.wait("@getNewDeployment");
  });
});
