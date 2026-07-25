/// <reference path="../../support/index.d.ts" />

// student-dashboard-lists-deployments
// ───────────────────────────────────
// P0 success-path test: a PURE student (roles=["student"], no lecturer/admin)
// landing on `/` must be routed to /student/dashboard and see their assigned
// deployments, loaded from GET /api/v1/student/deployments.
//
// Why this test exists
//   The student self-service area (StudentDashboard.tsx + the pure-student
//   branch of App.tsx) is a distinct surface from the lecturer app. It has its
//   own router registration (only /student/*, /config, and a catch-all
//   redirect) and its own single API fetch (getStudentDeployments(), NO query
//   params). If either the pure-student routing or that fetch/render regresses,
//   students land on a blank page and never see the environments their lecturer
//   assigned to them. This spec pins that core path end to end.
//
// Fixture notes
//   - student/deployments-list.json wraps two StudentDeploymentDto rows in the
//     EnvelopeArray shape ({ success, message, data, errors, timestamp,
//     request_id }) that getStudentDeployments() unwraps via `resp?.data ?? []`
//     in src/api/student.ts.
//   - Statuses are varied (running / deploying) so both StatusBadge branches
//     that a happy-path list exercises render: running → "Läuft",
//     deploying → "Wird bereitgestellt".

describe("StudentDashboard · lists assigned deployments", () => {
  beforeEach(() => {
    // mockApi wires harmless GET defaults. The pure-student bootstrap does NOT
    // call any of them (no openstack-projects/quotas/deployments gate for
    // students), but calling it is safe and keeps the spec consistent with the
    // rest of the suite. The student endpoint is registered AFTER so — even if
    // it overlapped — the later registration would win on Cypress's stack.
    cy.mockApi();
    cy.intercept("GET", "/api/v1/student/deployments", {
      fixture: "student/deployments-list.json",
    }).as("getStudentDeployments");
  });

  it("routes / → /student/dashboard and renders the deployment cards", () => {
    // Pure student visits the app root.
    cy.loginAs("student", "/");

    // App.tsx pure-student branch registers `/` → Navigate /student/dashboard.
    cy.location("pathname").should("eq", "/student/dashboard");

    // Proves getStudentDeployments() actually fired (no arbitrary timer).
    cy.wait("@getStudentDeployments");

    // ── Page shell ──────────────────────────────────────────────────────────
    // Unconditional header inside StudentDashboard — anchor that the page
    // rendered at all.
    cy.contains("h1", "Meine Deployments").should("be.visible");
    cy.contains(
      "Hier siehst du alle Umgebungen, die dir dein Dozent zugewiesen hat.",
    ).should("be.visible");

    // ── Deployment cards ────────────────────────────────────────────────────
    // Each fixture row's name (CardTitle) must reach the DOM.
    cy.contains("sql-lab-stu").should("be.visible");
    cy.contains("web-workshop-stu").should("be.visible");

    // StatusBadge mapping. running → "Läuft", deploying → "Wird bereitgestellt".
    // Hitting both branches means a StatusBadge regression surfaces here.
    cy.contains("Läuft").should("be.visible");
    cy.contains("Wird bereitgestellt").should("be.visible");

    // Sanity: the loading placeholder must be gone once data resolved.
    cy.contains("Lade Deployments...").should("not.exist");

    // ── Sidebar ─────────────────────────────────────────────────────────────
    // A pure student sees exactly one nav item ("Meine Deployments") and the
    // role label "Student". The <h1> also says "Meine Deployments", so scope
    // the nav assertion to the <nav> element to prove the nav item exists.
    cy.get("nav").contains("Meine Deployments").should("be.visible");
    cy.contains("Student").should("be.visible");
  });
});
