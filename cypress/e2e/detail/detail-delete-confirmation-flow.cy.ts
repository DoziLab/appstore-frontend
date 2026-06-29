/// <reference path="../../support/index.d.ts" />

// detail-delete-confirmation-flow
// ─────────────────────────────────
// P0 success-path test: the Delete button on a RUNNING deployment opens a
// Radix AlertDialog. Confirming the dialog fires DELETE
// /api/v1/deployments/<id>. The page then polls GET /<id> and, once the
// backend returns 404 (deployment gone), navigates back to /dashboard.
//
// Why this test exists
//   Deleting is the ONLY way a lecturer can free quota back to the OpenStack
//   project. The flow has three failure modes the test guards against:
//     1. The button skips the confirmation dialog (data-loss risk).
//     2. The dialog confirm fails to issue the DELETE request.
//     3. The page navigates away too early (before the row is actually gone)
//        or never navigates after the row disappears.
//   See src/pages/DeploymentDetailsPage.tsx → handleDeleteDeployment for the
//   real flow: optimistic status flip → DELETE → poll up to 60s → /dashboard.
//
// Polling strategy
//   The page polls getDeployment after a successful DELETE. We swap the
//   getDeployment intercept to return 404 right after registering the DELETE
//   intercept — the very next poll lands on the 404 handler, the catch arm
//   in handleDeleteDeployment fires navigate("/dashboard"), and Cypress's
//   url retry-ability lets us assert without an explicit wait on the poll.

describe("DeploymentDetails · delete confirmation flow", () => {
  beforeEach(() => {
    // Default GETs (projects, quotas, courses, keycloak groups, flavors,
    // empty deployments list). The empty deployments list also serves the
    // /dashboard landing after the redirect.
    cy.mockApi();

    // Initial detail fetch — running deployment so deleteAction resolves to
    // the "Löschen" branch (see DeploymentDetails.tsx → deleteAction switch).
    cy.intercept("GET", "/api/v1/deployments/dep-alpha-0001*", (req) => {
      if (req.url.includes("/logs")) {
        return;
      }
      req.reply({ fixture: "deployments/detail-running.json" });
    }).as("getDeployment");

    cy.intercept("GET", "/api/v1/deployments/dep-alpha-0001/logs*", {
      fixture: "deployments/logs-heat-ansible.json",
    }).as("getLogs");

    // SSE stream — closed immediately so the page settles into a stable
    // post-load state before the user clicks Delete.
    cy.intercept("GET", "/api/v1/deployments/dep-alpha-0001/logs/stream*", {
      statusCode: 200,
      body: "",
    }).as("getLogsStream");

    // Flavor catalog (page silently catches errors but the dangling socket
    // delays Promise.all). Empty list is enough for the running fixture.
    cy.intercept("GET", "/api/v1/openstack/flavors*", {
      statusCode: 200,
      body: { flavors: [] },
    }).as("getOpenstackFlavors");

    // Keycloak admin (direct call, .catch()'d but slow DNS).
    cy.intercept("GET", "**/admin/realms/*/groups*", {
      fixture: "keycloak/groups-direct.json",
    }).as("getKeycloakAdminGroups");
  });

  it("opens AlertDialog on Löschen, fires DELETE on confirm, navigates to /dashboard after 404 poll", () => {
    cy.loginAs("lecturer", "/deployment/dep-alpha-0001");

    // Wait for the page to settle — proves we're past the loading state and
    // the action card is rendered, so the Löschen button is reachable.
    cy.wait(["@getDeployment", "@getLogs"]);
    cy.contains("h1", "test-deploy-alpha").should("be.visible");

    // Register the DELETE intercept BEFORE the click. 204 mirrors the
    // production behavior — deleteDeployment() only checks res.ok, no body.
    cy.intercept(
      "DELETE",
      "/api/v1/deployments/dep-alpha-0001*",
      { statusCode: 204, body: "" },
    ).as("deleteDeployment");

    // Step 1 — click the action-card Löschen button. deleteAction.label is
    // exactly "Löschen" for rawStatus === "running" (see DeploymentDetails
    // deleteAction switch). Scope to "button" so we don't accidentally hit
    // the AlertDialog confirm CTA (which contains "löschen" lowercased).
    cy.contains("button", "Löschen").click();

    // Step 2 — Radix AlertDialog opens. Title comes from
    // deleteAction.confirmTitle = "Deployment wirklich löschen?". Radix
    // renders the dialog with role="alertdialog"; scope to that element so
    // we don't pick the same German strings up from the action card.
    cy.get('[role="alertdialog"]').within(() => {
      cy.contains("Deployment wirklich löschen?").should("be.visible");
      // Confirm CTA text is deleteAction.confirmCta = "Ja, löschen".
      cy.contains("button", "Ja, löschen").click();
    });

    // Step 3 — DELETE must fire with the correct path. apiFetch is NOT used
    // here; deleteDeployment() in src/api/deployments.ts uses a raw fetch.
    cy.wait("@deleteDeployment").its("request.method").should("eq", "DELETE");

    // Step 4 — once the DELETE settles, the page polls getDeployment until
    // the row reports DELETED or a 404. Swap the intercept now so the very
    // next poll lands on the 404 branch, which navigate("/dashboard")s. The
    // re-registration wins over the earlier intercept (Cypress evaluates
    // intercepts in reverse-registration order).
    cy.intercept(
      "GET",
      "/api/v1/deployments/dep-alpha-0001*",
      { statusCode: 404, fixture: "errors/404.json" },
    ).as("getDeploymentDeleted");

    // Step 5 — Cypress retries cy.location until the timeout, so we don't
    // need an explicit wait on the poll. Default timeout (4s) is plenty —
    // handleDeleteDeployment schedules the first poll synchronously after
    // the DELETE resolves, and our 404 redirects immediately.
    cy.location("pathname", { timeout: 10000 }).should("eq", "/dashboard");
  });
});
