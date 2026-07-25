/// <reference path="../../support/index.d.ts" />

// redeploy-deployment-config-override
// ─────────────────────────────────────
// P1 success-path test for the Redeploy-with-config-override feature (#192).
//
// Flow under test
//   The owner of a RUNNING deployment opens the "Aktionen" card, clicks
//   "Neu deployen" (RefreshCw), which opens the RedeployDialog in
//   kind:"deployment" mode. The dialog renders one editable field per key in
//   deployment.deploymentParameters.parameters. The owner changes ONE text
//   field, keeps the "Zugangsdaten beibehalten" checkbox (default checked),
//   and submits. A POST /redeploy fires with ONLY the changed key in
//   deployment_parameter_overrides plus preserve_credentials:true.
//
// deployment_parameters parsing (verified in DeploymentDetailsPage.tsx)
//   backend `deployment_parameters` is a JSON *string*. buildDeploymentData
//   JSON.parse()s it into `deploymentParameters`, and DeploymentDetails passes
//   `deployment.deploymentParameters?.parameters` as `currentParameters` into
//   RedeployDialog. So the fixture stores
//     "deployment_parameters": "{\"parameters\":{\"hostname\":\"old-host\",\"replicas\":2}}"
//   which yields dialog fields:
//     - #redeploy-param-hostname  → text  (typeof "old-host" === "string")
//     - #redeploy-param-replicas  → number (typeof 2 === "number")
//   RedeployDialog.buildOverrides() diffs against the frozen initial values and
//   emits ONLY changed keys — so changing just hostname yields
//   { hostname: "new-host" } as the override.
//
// Why this test matters
//   Redeploy-with-override is a new core feature. If the diff logic or the POST
//   breaks, lecturers redeploy with the wrong parameters — this locks the wire
//   contract (only changed keys + preserve_credentials, extra="forbid" body).

describe("DeploymentDetails · redeploy deployment config override", () => {
  beforeEach(() => {
    // Default GETs (projects → single.json with active project id
    // 1111…1111, quotas, empty deployments, courses, keycloak groups,
    // flavors).
    cy.mockApi();

    // Detail fetch — RUNNING, owned by user-lec-1 (lecturer sub), and with a
    // deployment_parameters JSON string so the dialog renders config fields.
    cy.intercept("GET", "/api/v1/deployments/dep-alpha-0001*", (req) => {
      if (req.url.includes("/logs")) {
        return;
      }
      req.reply({ fixture: "deployments/detail-running-with-params.json" });
    }).as("getDeployment");

    cy.intercept("GET", "/api/v1/deployments/dep-alpha-0001/logs*", {
      fixture: "deployments/logs-heat-ansible.json",
    }).as("getLogs");

    // SSE stream closed immediately — page settles into a stable post-load
    // state before we interact.
    cy.intercept("GET", "/api/v1/deployments/dep-alpha-0001/logs/stream*", {
      statusCode: 200,
      body: "",
    }).as("getLogsStream");

    cy.intercept("GET", "/api/v1/openstack/flavors*", {
      statusCode: 200,
      body: { flavors: [] },
    }).as("getOpenstackFlavors");

    cy.intercept("GET", "**/admin/realms/*/groups*", {
      fixture: "keycloak/groups-direct.json",
    }).as("getKeycloakAdminGroups");
  });

  it("changes one parameter and POSTs redeploy with only that override + preserve_credentials", () => {
    // Redeploy endpoint — 202 with a RedeployDeploymentResponse envelope
    // (redeployDeployment reads json.data). Registered before login so the
    // click can't race it.
    cy.intercept(
      "POST",
      "/api/v1/deployments/dep-alpha-0001/redeploy*",
      {
        statusCode: 202,
        body: {
          success: true,
          message: "ok",
          data: {
            deployment_id: "dep-alpha-0001",
            instance_count: 1,
            status: "REDEPLOYING",
            preserve_credentials: true,
          },
          errors: null,
          timestamp: "2026-07-25T00:00:00Z",
          request_id: "req-redeploy",
        },
      },
    ).as("redeploy");

    cy.loginAs("lecturer", "/deployment/dep-alpha-0001");
    cy.wait("@getDeployment");
    cy.contains("h1", "test-deploy-alpha").should("be.visible");

    // Open the RedeployDialog via the Aktionen-card trigger. Scope to a
    // button so we don't match the dialog submit (same label) once it opens.
    cy.contains("button", "Neu deployen").scrollIntoView().click();

    // Dialog rendered its config fields from deployment_parameters.parameters.
    cy.get('[role="dialog"]').within(() => {
      cy.contains("Deployment neu deployen").should("be.visible");

      // Change only the hostname (text field). replicas (number) stays
      // untouched, so it must NOT appear in the override.
      cy.get("#redeploy-param-hostname")
        .should("have.value", "old-host")
        .clear()
        .type("new-host");

      // preserve_credentials checkbox is checked by default — leave it.
      cy.get("#redeploy-preserve-credentials").should(
        "have.attr",
        "data-state",
        "checked",
      );

      // Submit — scoped to the dialog so we hit the dialog CTA, not the card
      // trigger.
      cy.contains("button", "Neu deployen").click();
    });

    // Wire-contract assertions: only the changed key in the override,
    // preserve_credentials true, and the active openstack project on the query.
    cy.wait("@redeploy").then(({ request }) => {
      expect(request.body.deployment_parameter_overrides).to.deep.equal({
        hostname: "new-host",
      });
      expect(request.body.preserve_credentials).to.equal(true);
      expect(request.url).to.include(
        "openstack_project_id=11111111-1111-1111-1111-111111111111",
      );
    });

    // Dialog closes after the successful 202 (onOpenChange(false)).
    cy.get('[role="dialog"]').should("not.exist");
  });
});
