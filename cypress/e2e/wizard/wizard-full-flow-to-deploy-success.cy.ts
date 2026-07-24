/// <reference path="../../support/index.d.ts" />

// wizard-full-flow-to-deploy-success
// ───────────────────────────────────
// P0 success-path test for the DeploymentWizard's end-to-end submit.
//
// Why this test exists
//   Submitting the wizard is the single most important user action in the
//   app — it's how a new application actually gets deployed. The flow has
//   three load-bearing pieces wired in series:
//     (1) DeploymentWizard.handleDeploy() assembles a DeploymentCreateRequest
//         from all wizard state (name, version, group, parameters, files,
//         stack_assignments, teacher, openstack_project_id),
//     (2) createDeployment() POSTs that payload to /api/v1/deployments and
//         returns the envelope { success, data: { id, ... } },
//     (3) onComplete(deployment.data.id) in DeploymentWizardPage navigates
//         to /deployment/<id>, where DeploymentDetailsPage takes over and
//         fetches the new deployment.
//   If any link in that chain breaks, the wizard becomes unable to start
//   deployments — which is effectively the entire purpose of the product.
//
// What's asserted
//   - Walking step 0 (name + group) and clicking "Direkt zur Übersicht"
//     reaches the review step (proves the shortcut path works on a
//     parameter-less template).
//   - Clicking "Anwendung deployen" fires POST /api/v1/deployments with the
//     typed name in the body (proves the wizard wired user input through to
//     the API payload).
//   - On 201 response, the URL becomes /deployment/dep-new-001 (proves the
//     ID from the response is used in navigation).
//   - DeploymentDetailsPage subsequently fetches GET /api/v1/deployments/
//     dep-new-001 (proves the next page mounts with the new ID).
//
// The error path lives in the sibling spec
// `wizard-deploy-api-error-stays-on-review`.

describe("DeploymentWizard · Full flow to deploy success", () => {
  beforeEach(() => {
    cy.mockApi();

    // Wizard mount fetches: template detail + versions list. The active
    // version (tv-wp-1) is auto-selected, which triggers the version-detail
    // fetch. The minimal wordpress version fixture has empty parameters
    // and user_files → steps collapse to just "Template & Zugriff" +
    // "Übersicht", so the shortcut button lands directly on review.
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

    // Keycloak admin endpoints (groups + members). Direct hits — NOT via
    // /api/v1/*. We need at least one member: handleDeploy() rejects
    // per_group submits where every group has zero students (and the
    // wizard auto-creates one empty default group as soon as members > 0),
    // so we hand it a single student that the "Auto-Verteilen" button can
    // distribute into the auto-created Gruppe 1.
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

    // The deploy submit hits POST /api/v1/deployments. apiFetch treats any
    // non-2xx as an error; the backend returns 201 Created on success
    // (see DeploymentCreateRequest path). Intercept the POST with a 201
    // envelope so handleDeploy() resolves with `data.id = dep-new-001`.
    cy.intercept(
      "POST",
      "/api/v1/deployments",
      { statusCode: 201, fixture: "deployments/created.json" },
    ).as("createDeployment");

    // After navigation, DeploymentDetailsPage mounts and fetches the new
    // deployment + its logs + flavors + courses + groups. We already gave
    // the list endpoints sensible defaults via cy.mockApi; only the per-id
    // GET needs a fixture matching the created deployment's status.
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

  it("walks step 0 → review → deploy, fires POST /api/v1/deployments and navigates to /deployment/<id>", () => {
    cy.loginAs("lecturer", "/deploy/tpl-wp-0001");

    // Wait for the wizard to mount and settle on step 0.
    cy.wait("@getTemplateDetail");
    cy.wait("@getTemplateVersionsForTemplate");
    cy.contains("Template & Zugriff").should("be.visible");

    // ── Fill step 0 ────────────────────────────────────────────────────
    // Deployment name. Pattern-valid kebab-case → passes the
    // validateDeploymentNamePattern regex without the sanitizer mutating
    // it, so the value reaching the POST body matches what we type.
    cy.get("#deployment-name").clear().type("test-deploy-from-wizard");
    cy.get("#deployment-name").should("have.value", "test-deploy-from-wizard");

    // Pick the single Keycloak group we mocked. Radix Select is opened
    // via its trigger (combobox role); the option then appears in a
    // portal so we target it by role.
    cy.wait("@getKeycloakGroupsDirect");
    cy.contains("label", /Kurs auswählen/i)
      .parent()
      .find('[role="combobox"]')
      .click();
    cy.get('[role="option"]').contains("Test-Gruppe").click();
    cy.wait("@getKeycloakGroupMembers");

    // The wizard auto-creates one empty "Gruppe 1" when members > 0;
    // handleDeploy() rejects if every group has zero students, so we
    // need the student assigned. The GroupManager exposes an
    // "Auto-Verteilen" button that does exactly that distribution.
    cy.contains("button", /Auto-Verteilen/i).click();

    // ── Shortcut to review ──────────────────────────────────────────────
    // "Direkt zur Übersicht" jumps to the last step (overview). With
    // empty parameters/user_files, that step IS the second step.
    cy.contains("button", "Direkt zur Übersicht")
      .should("not.be.disabled")
      .click();
    cy.contains("Deployment-Zusammenfassung").should("be.visible");

    // ── Submit ──────────────────────────────────────────────────────────
    // The final-step button reads "Anwendung deployen" (per the
    // currentStep === steps.length - 1 branch in DeploymentWizard.tsx).
    cy.contains("button", "Anwendung deployen").click();

    // Verify the POST fired with the typed name. The full payload also
    // contains template_version_id, course_id, openstack_project_id,
    // stack_assignments, teacher, etc. — pinning `name` is enough to
    // prove the wizard threaded user input into the API call; the schema
    // shape itself is covered by the backend tests.
    cy.wait("@createDeployment").then((intercept) => {
      expect(intercept.request.body).to.have.property(
        "name",
        "test-deploy-from-wizard",
      );
      expect(intercept.request.body).to.have.property(
        "template_version_id",
        "tv-wp-1",
      );
      expect(intercept.request.body).to.have.property(
        "course_id",
        "grp-test-1",
      );
    });

    // ── Navigation to /deployment/<id> ──────────────────────────────────
    // DeploymentWizardPage.handleComplete navigates to
    // /deployment/${deploymentId} using the id from the response. The
    // detail page then fetches itself — waiting on that confirms the
    // route actually mounted with the new id (not just that the URL
    // updated).
    cy.url().should("include", "/deployment/dep-new-001");
    cy.wait("@getNewDeployment");
  });
});
