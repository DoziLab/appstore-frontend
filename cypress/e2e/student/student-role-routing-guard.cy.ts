/// <reference path="../../support/index.d.ts" />

// student-role-routing-guard
// ──────────────────────────
// P0 permission test: a PURE student (roles=["student"], no lecturer/admin)
// must NOT be able to reach lecturer/admin surfaces. App.tsx renders a
// student-only <Routes> block (only /student/*, /config, and a catch-all
// redirect). Any non-student path — /dashboard, /appstore, /courses, /admin/*
// — therefore hits the catch-all `*` → Navigate /student/dashboard.
//
// Why this test exists
//   The pure-student branch in App.tsx is the client-side permission gate that
//   keeps students out of the lecturer/admin UI. If that branch regresses (e.g.
//   the catch-all is dropped or a lecturer route leaks in), a student could
//   mount a lecturer page and fire lecturer-only endpoints (which the backend
//   answers with 403, but the UI would still attempt them and break). This spec
//   pins the guard: direct navigation to non-student routes always redirects to
//   /student/dashboard, and the lecturer/admin data endpoints never fire.
//
// Strategy
//   - cy.mockApi() registers the lecturer/admin GET defaults (getDeployments,
//     getTemplates, …). For a pure student NONE of these must be requested — we
//     assert 0 calls on getDeployments and getTemplates to prove the student
//     never mounted a lecturer page.
//   - The student's own endpoint (GET /api/v1/student/deployments) is stubbed
//     with the existing student/deployments-list.json fixture so the student
//     dashboard renders its heading, proving the redirect landed on a real page
//     and not a blank screen.

describe("App routing · pure-student permission guard", () => {
  beforeEach(() => {
    // Lecturer/admin GET defaults. If the guard holds, none of these fire for
    // a pure student. Registered first so the student override below wins.
    cy.mockApi();
    // The student's own list endpoint — stubbed so the dashboard renders.
    cy.intercept("GET", "/api/v1/student/deployments", {
      fixture: "student/deployments-list.json",
    }).as("getStudentDeployments");
  });

  it("redirects a pure student from /dashboard and /appstore to /student/dashboard", () => {
    // ── /dashboard (lecturer home) → catch-all → /student/dashboard ──────────
    cy.loginAs("student", "/dashboard");
    cy.location("pathname").should("eq", "/student/dashboard");

    // The student endpoint firing + heading rendering proves we landed on the
    // real student page (not a blank / lecturer shell).
    cy.wait("@getStudentDeployments");
    cy.contains("h1", "Meine Deployments").should("be.visible");

    // ── /appstore (lecturer AppStore) → catch-all → /student/dashboard ───────
    cy.loginAs("student", "/appstore");
    cy.location("pathname").should("eq", "/student/dashboard");
    cy.contains("h1", "Meine Deployments").should("be.visible");

    // ── Lecturer/admin endpoints must NEVER have fired ───────────────────────
    // If a lecturer route had mounted, DashboardPage would have called the
    // deployments list and AppStorePage the templates list. Zero calls proves
    // the student never reached those surfaces.
    cy.get("@getDeployments.all").should("have.length", 0);
    cy.get("@getTemplates.all").should("have.length", 0);
  });
});
