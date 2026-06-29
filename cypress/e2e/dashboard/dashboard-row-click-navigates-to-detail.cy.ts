/// <reference path="../../support/index.d.ts" />

// dashboard-row-click-navigates-to-detail
// ────────────────────────────────────────
// P0 success-path test: clicking a deployment row in the Dashboard's recent
// deployments list must route the user to /deployment/<id> AND the detail
// page must fire its own deployment fetch.
//
// Why this test exists
//   Dashboard.tsx is the lecturer's landing surface; the recent-deployments
//   list is the primary entry point into a single deployment. The row is a
//   plain <div> with an onClick that calls onSelectDeployment(deployment.id).
//   DashboardPage.tsx then navigates to `/deployment/${id}` — note: although
//   the prop is named `deploymentName`, the value passed is the row's `id`
//   from getAllDeployments (see Dashboard.tsx line 217). If either the click
//   handler, the prop wiring, or the route binding regresses, lecturers
//   can't reach any deployment detail page.
//
// Fixture notes
//   - deployments/list-3.json provides three rows; we click the first
//     ("test-deploy-alpha", id "dep-alpha-0001").
//   - deployments/detail-running.json mirrors the alpha row but uses the
//     full DeploymentResponse envelope ({ success, data: DeploymentDto, ... })
//     that getDeployment unwraps. Status is "RUNNING" (upper-case) so
//     STATUS_MAP collapses it to "running" and DeploymentDetails renders
//     the action button + name heading immediately.
//   - deployments/logs-empty.json keeps getDeploymentLogs from blocking the
//     loading state (the page awaits all five parallel fetches before
//     clearing `loadingDeployment`).

describe("Dashboard · row click navigates to deployment detail", () => {
  beforeEach(() => {
    // Default intercepts: projects, quotas, empty deployments list, courses,
    // groups, flavors. We then override the LIST endpoint with 3 rows and
    // register detail-specific intercepts AFTER mockApi so the later
    // registrations win on the Cypress intercept stack.
    cy.mockApi();
    cy.intercept("GET", /\/api\/v1\/deployments(\?[^/]*)?$/, {
      fixture: "deployments/list-3.json",
    }).as("getDeploymentsList");

    // Detail page calls: GET /api/v1/deployments/<id>?openstack_project_id=...
    // The mockApi regex for the list explicitly excludes paths beyond
    // /deployments, so this more specific intercept catches only the detail
    // fetch — no aliasing collision with @getDeploymentsList.
    cy.intercept("GET", "/api/v1/deployments/*", (req) => {
      // Skip the /logs and /logs/stream sub-paths — those have their own
      // intercepts below. Cypress matches "*" greedily but we want this
      // handler to only fire for the bare /<id> endpoint.
      if (req.url.includes("/logs")) {
        return;
      }
      req.reply({ fixture: "deployments/detail-running.json" });
    }).as("getDeploymentDetail");

    // Detail page also fetches logs and starts an SSE stream. We stub both
    // with empty bodies so the page doesn't hang on the loading state.
    cy.intercept("GET", "/api/v1/deployments/*/logs*", {
      fixture: "deployments/logs-empty.json",
    }).as("getDeploymentLogs");
    cy.intercept("GET", "/api/v1/deployments/*/logs/stream*", {
      statusCode: 200,
      body: "",
    }).as("getDeploymentLogsStream");

    // DeploymentDetailsPage calls getFlavors() which hits
    // /api/v1/openstack/flavors (NOT /api/v1/flavors* that mockApi covers).
    // The catch handler in the page rescues failure, but a real 500 from
    // Vite's proxy or a long-pending socket would keep Promise.all blocked
    // until the network layer gives up. Stub it explicitly with an empty
    // flavor catalog — the detail page falls back to '—' for resources.
    cy.intercept("GET", "/api/v1/openstack/flavors*", {
      statusCode: 200,
      body: { flavors: [] },
    }).as("getOpenstackFlavors");

    // DeploymentDetailsPage also calls getKeycloakGroups() which hits the
    // Keycloak admin API directly (e.g. https://keycloak.test/admin/realms/
    // Dozilab/groups). The promise is wrapped in .catch(...), but the DNS
    // failure for keycloak.test can take several seconds, easily exceeding
    // Cypress's default 8s assertion timeout. Short-circuit it.
    cy.intercept("GET", "**/admin/realms/*/groups*", {
      statusCode: 200,
      body: [],
    }).as("getKeycloakAdminGroups");
  });

  it("routes to /deployment/<id> and fires the detail fetch", () => {
    cy.loginAs("lecturer", "/dashboard");

    // Block until the dashboard list call returns so the rows are rendered.
    cy.wait("@getDeploymentsList");

    // The row text is the deployment name. The clickable container is the
    // ancestor <div> with the onClick handler — cy.contains(...).click()
    // bubbles through React's synthetic event handler regardless of which
    // child element actually gets the DOM click target, so this is stable
    // without adding a test-only data-testid.
    cy.contains("test-deploy-alpha").click();

    // Route must reflect the deployment ID, NOT the name. Dashboard.tsx
    // passes deployment.id (e.g. "dep-alpha-0001") to onSelectDeployment;
    // DashboardPage.tsx navigates with that value.
    cy.url().should("match", /\/deployment\/dep-alpha-0001$/);

    // Proves the detail page actually started loading — if routing
    // succeeded but the page failed to fire its fetch, this would hang.
    cy.wait("@getDeploymentDetail");

    // Final paint assertion: the detail page's <h1> shows the deployment
    // name once `loadingDeployment` flips false. This proves not just the
    // navigation but also that the fetched payload made it through the
    // DeploymentDetailsPage render pipeline.
    cy.contains("h1", "test-deploy-alpha").should("be.visible");
  });
});
