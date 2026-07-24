/// <reference path="../../support/index.d.ts" />

// appstore-deploy-button-navigates-to-wizard
// ──────────────────────────────────────────
// P0 success-path test for the entry into the deployment wizard. A lecturer
// on /appstore must be able to click "Deploy" on a template card and end up
// on /deploy/<templateId> with the wizard mounting and beginning its initial
// fetches.
//
// Why this test exists
//   This transition is the only path into the deployment flow — AppStore.tsx
//   wires the Deploy button to `onDeploy(template.id)`, AppStorePage.tsx
//   resolves that callback to `navigate('/deploy/' + templateId)`, and
//   DeploymentWizardPage mounts DeploymentWizard which immediately fetches
//   the template detail and its versions. If any of these links break the
//   product's core feature is dead: users can browse but can't deploy.
//
// What's asserted
//   (1) the URL lands on /deploy/<templateId> with the correct id from the
//       clicked card (not just the first one in the list),
//   (2) the wizard actually mounts and fires GET /api/v1/templates/<id> and
//       GET /api/v1/template-versions/template/<id> — proves the page is
//       loading data, not stuck on a blank route, and
//   (3) the step-0 heading "Template & Zugriff" appears, confirming the
//       wizard rendered past its initial loading state.

describe("AppStore · Deploy button navigates to wizard", () => {
  beforeEach(() => {
    // Default intercepts: serves approved-list.json for /api/v1/templates*
    // (3 templates incl. wordpress-demo with one active approved version).
    cy.mockApi();

    // Wizard-specific intercepts. Registered AFTER cy.mockApi so they win
    // over the generic /api/v1/templates* and /api/v1/template-versions*
    // patterns when the wizard fires its detail fetches on mount.
    cy.intercept("GET", "/api/v1/templates/tpl-wp-0001", {
      fixture: "templates/detail-wordpress.json",
    }).as("getTemplateDetail");
    cy.intercept(
      "GET",
      "/api/v1/template-versions/template/tpl-wp-0001*",
      { fixture: "template-versions/list-wordpress.json" },
    ).as("getTemplateVersionsForTemplate");
    // The wizard auto-selects the active version (tv-wp-1) which triggers a
    // GET /api/v1/template-versions/<id>?include_parameters=true via
    // getTemplateVersion(). Without an intercept this hits the Vite proxy
    // and fails — answer with the active version's payload so wizard state
    // settles cleanly.
    cy.intercept(
      "GET",
      "/api/v1/template-versions/tv-wp-1*",
      {
        body: {
          success: true,
          message: "ok",
          data: {
            id: "tv-wp-1",
            template_id: "tpl-wp-0001",
            version: "1.0.0",
            git_commit_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            is_active: true,
            approval_status: "approved",
            approved_by_id: "user-admin-1",
            approved_at: "2026-06-01T10:00:00Z",
            rejection_reason: null,
            created_at: "2026-05-20T10:00:00Z",
            parameters: [],
            user_files: [],
            allow_user_files: false,
          },
          errors: null,
          timestamp: "2026-06-27T00:00:00Z",
          request_id: "req-template-version-tv-wp-1",
        },
      },
    ).as("getTemplateVersionDetail");
    // Keycloak groups are fetched against the real Keycloak server URL
    // (authServerUrl from the lecturer fixture), not via /api/v1/*. The
    // wizard's loadData uses Promise.all([getTemplate, getKeycloakGroups]);
    // if the groups call rejects the wizard shows the error state instead of
    // step 0, so we must answer it explicitly here.
    cy.intercept("GET", "**/admin/realms/*/groups", { body: [] }).as(
      "getKeycloakGroupsList",
    );
  });

  it("clicking Deploy on wordpress-demo routes to /deploy/<id> and begins loading the wizard", () => {
    cy.loginAs("lecturer", "/appstore");

    // Wait for the template list to arrive so all cards (and their Deploy
    // buttons) are in the DOM and not disabled.
    cy.wait("@getTemplates");
    cy.contains("wordpress-demo").should("be.visible");

    // Scope to the card containing "wordpress-demo" and click its Deploy
    // button — guards against picking up the first card's button instead
    // of the one we mean to click.
    cy.contains("[data-slot='card']", "wordpress-demo")
      .within(() => {
        cy.contains("button", "Deploy").click();
      });

    // Hard URL assertion: the navigate('/deploy/' + id) in AppStorePage
    // produced the expected route with wordpress-demo's id.
    cy.url().should("match", /\/deploy\/tpl-wp-0001$/);

    // Wizard mounted and fired its initial fetches — proves the route is
    // wired to DeploymentWizardPage and the wizard's mount-time useEffects
    // ran. These two intercepts together pin both calls in
    // DeploymentWizard.tsx's loadData / loadVersions.
    cy.wait("@getTemplateDetail");
    cy.wait("@getTemplateVersionsForTemplate");

    // Step-0 heading. DeploymentWizard.tsx defines the first step as
    // "Template & Zugriff" — its appearance confirms the wizard rendered
    // past its loading state and is presenting the user with the first
    // interactive step.
    cy.contains("Template & Zugriff").should("be.visible");
  });
});
