/// <reference path="../../support/index.d.ts" />

// detail-renders-status-and-phases
// ─────────────────────────────────
// P0 success-path test: opening /deployment/<id> for a RUNNING deployment
// with HEAT + ANSIBLE log entries must render the status badge, both phase
// rows, and a progress percentage. No error UI ("Deployment nicht gefunden")
// must appear.
//
// Why this test exists
//   The DeploymentDetailsPage is the central status surface for a lecturer's
//   running deployment. It fans out five parallel fetches (courses, keycloak
//   groups, deployment, logs, flavors), then derives the HEAT/ANSIBLE phase
//   pipeline locally from the log event_types (see buildPhases in
//   DeploymentDetailsPage.tsx). If the phase derivation, the status mapping
//   (RUNNING → "running" → "Erfolgreich bereitgestellt"), or the progress
//   calculation regresses, users lose the ability to see whether their
//   deployment is healthy without inspecting the backend manually.
//
// Fixture notes
//   - deployments/detail-running.json: status "RUNNING" so the page reaches
//     the "running" branch of STATUS_MAP and calcProgress returns 100.
//   - deployments/logs-heat-ansible.json: four HEAT events (incl. VM_READY,
//     which marks the heat phase complete) and four ANSIBLE events (incl.
//     ANSIBLE_COMPLETED, which marks the ansible phase complete). Both
//     phases render as "Fertig" badges with the labels "Infrastruktur (Heat)"
//     and "Konfiguration (Ansible)".

describe("DeploymentDetails · renders status, phases, and progress", () => {
  beforeEach(() => {
    // Default intercepts (projects, quotas, courses, keycloak groups, flavors,
    // empty deployments list). Detail-specific intercepts registered AFTER so
    // they win on the Cypress intercept stack.
    cy.mockApi();

    // Detail fetch — bare /deployments/<id> only; the /logs and /logs/stream
    // sub-paths are matched by more specific intercepts below.
    cy.intercept("GET", "/api/v1/deployments/dep-alpha-0001*", (req) => {
      if (req.url.includes("/logs")) {
        return;
      }
      req.reply({ fixture: "deployments/detail-running.json" });
    }).as("getDeployment");

    // Initial logs payload — drives the phase derivation.
    cy.intercept("GET", "/api/v1/deployments/dep-alpha-0001/logs*", {
      fixture: "deployments/logs-heat-ansible.json",
    }).as("getLogs");

    // SSE stream — initial render only needs the static log payload above,
    // so close the stream immediately with an empty body. Without this the
    // fetch hangs and Cypress's network-idle wait can stretch out.
    cy.intercept("GET", "/api/v1/deployments/dep-alpha-0001/logs/stream*", {
      statusCode: 200,
      body: "",
    }).as("getLogsStream");

    // /openstack/flavors is NOT covered by mockApi (that one matches
    // /api/v1/flavors*). The page catches failures but a long-pending socket
    // delays Promise.all — stub with an empty flavor catalog.
    cy.intercept("GET", "/api/v1/openstack/flavors*", {
      statusCode: 200,
      body: { flavors: [] },
    }).as("getOpenstackFlavors");

    // getKeycloakGroups() hits the Keycloak admin endpoint directly. The
    // promise is .catch()'d, but the DNS failure for keycloak.test takes
    // several seconds — short-circuit it.
    cy.intercept("GET", "**/admin/realms/*/groups*", {
      fixture: "keycloak/groups-direct.json",
    }).as("getKeycloakAdminGroups");
  });

  it("shows the status badge, HEAT + ANSIBLE phases, and progress", () => {
    cy.loginAs("lecturer", "/deployment/dep-alpha-0001");

    // Block on the two fetches that drive the rendered phase pipeline. The
    // page only flips `loadingDeployment` off once Promise.all resolves; if
    // either of these regresses to a 404/500, the test fails fast here
    // rather than later on a missing assertion.
    cy.wait(["@getDeployment", "@getLogs"]);

    // Deployment name from detail-running.json — heading paint proves the
    // page exited the "Lade Deployment..." state with valid data.
    cy.contains("h1", "test-deploy-alpha").should("be.visible");

    // Status badge for the "running" mapping without a failed phase. The
    // exact string is hard-coded in DeploymentDetails.getStatusBadge() and
    // is the user-facing signal that the deployment is healthy.
    cy.contains("Erfolgreich bereitgestellt").should("be.visible");

    // Phase rows — buildPhases() always emits both heat and ansible (in
    // that order) when logs exist. Labels are "Infrastruktur (Heat)" /
    // "Konfiguration (Ansible)"; the /heat/i and /ansible/i regexes match
    // those labels case-insensitively and would survive a label-copy tweak.
    cy.contains(/heat/i).should("be.visible");
    cy.contains(/ansible/i).should("be.visible");

    // Progress percent — calcProgress returns 100 for overallStatus
    // "running" (see DeploymentDetailsPage.tsx). The detail UI renders the
    // value as "{progress}%" in the steps card header; the regex matches
    // any percentage so a future tweak from 100% → "Abgeschlossen" badge
    // wouldn't silently break this assertion.
    cy.contains(/\d+\s*%/).should("be.visible");

    // Negative assertion: the "Deployment nicht gefunden" fallback (rendered
    // when deploymentData stays null) must NOT appear. Guards against a
    // future regression where the page falsely treats a valid payload as
    // missing — that fallback is the only way deploymentData renders empty.
    cy.contains("Deployment nicht gefunden").should("not.exist");
  });
});
