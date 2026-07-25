/// <reference path="../../support/index.d.ts" />

// student-deployment-details-credentials
// ──────────────────────────────────────
// P1 success test: a student opening /student/deployment/:id sees the
// deployment's VMs and their access credentials.
//
// Page flow (src/pages/StudentDeploymentDetails.tsx):
//   1. StudentDeploymentDetailsPage reads :deploymentId from the route and
//      renders StudentDeploymentDetails.
//   2. There is NO single-item endpoint — the page re-fetches the whole list
//      via GET /api/v1/student/deployments (getStudentDeployments) and filters
//      client-side by id. So the list fixture MUST contain "stu-dep-1".
//   3. Once the deployment is found, credentials auto-load via
//      GET /api/v1/student/deployments/{id}/credentials
//      (getStudentDeploymentCredentials). The response is an Envelope<T> —
//      the api unwraps `.data` into DeploymentCredentialsResponse.
//   4. Instances render through the shared CredentialInstanceCard with
//      mode="student": a group Accordion (first group open by default) with a
//      per-access row (Username / Password / URL). SSH accesses that carry an
//      ssh_private_key additionally show an "SSH Private Key" block.
//
// Why this test exists
//   Displaying the group credentials is the core value of the student area —
//   without it, students cannot reach their assigned VMs. This pins the two
//   chained fetches (list → filter → credentials) and the mode="student"
//   rendering of the CredentialInstanceCard.

describe("Student deployment details · VMs and credentials", () => {
  beforeEach(() => {
    // Lecturer/admin GET defaults (harmless for the student page). Registered
    // first so the student-specific overrides below win on later intercepts.
    cy.mockApi();

    // Student list endpoint — MUST include the target id, because the detail
    // page filters this list client-side (no single-item endpoint exists).
    cy.intercept("GET", "/api/v1/student/deployments", {
      fixture: "student/deployments-with-target.json",
    }).as("getStudentDeployments");

    // Credentials for the target deployment. Envelope response ({ data: … })
    // matching DeploymentCredentialsResponse.
    cy.intercept(
      "GET",
      "/api/v1/student/deployments/stu-dep-1/credentials",
      { fixture: "student/credentials.json" },
    ).as("getCredentials");
  });

  it("shows the deployment's VMs and its group access credentials", () => {
    cy.loginAs("student", "/student/deployment/stu-dep-1");

    // Both chained fetches fire: the list (filtered locally) and, once the
    // deployment is found, its credentials.
    cy.wait(["@getStudentDeployments", "@getCredentials"]);

    // ── Header: deployment name from the filtered list entry ────────────────
    cy.contains("h1", "Datenbank-Praktikum SS26").should("be.visible");

    // ── The two sections render ─────────────────────────────────────────────
    cy.contains("Virtuelle Maschinen").should("be.visible");
    cy.contains("Deine Zugangsdaten").should("be.visible");

    // ── VM list from the deployment fixture: name + IP badge / "keine IP" ────
    cy.contains("pg-lab-primary").should("be.visible");
    cy.contains("10.0.7.21").should("be.visible");
    cy.contains("pg-lab-web").should("be.visible");
    cy.contains("keine IP").should("be.visible");

    // ── Credentials card (CredentialInstanceCard, mode="student") ────────────
    // The group Accordion opens the first group by default → its access rows
    // are visible without a click.
    cy.contains("Gruppe A").should("be.visible");

    // Both access types from the single instance render. The type label sits
    // in a `truncate min-w-0` <h4>, so assert existence (be.visible fails on
    // the clipped element) rather than visibility.
    cy.contains("SSH").should("exist");
    cy.contains("Web URL").should("exist");

    // Username is rendered in clear text (only the password is masked).
    cy.contains("student-gruppe-a").should("be.visible");

    // SSH access carries a private key → the SSH Private Key block appears.
    // The label lives in a clipped Accordion/flex container, so assert exist.
    cy.contains("SSH Private Key").should("exist");

    // ── Password stays masked until the Eye toggle is used ───────────────────
    cy.contains("S3cure-Pw-42!").should("not.exist");

    // ── Back button is present ───────────────────────────────────────────────
    cy.contains("Zurück zur Übersicht").should("be.visible");
  });
});
