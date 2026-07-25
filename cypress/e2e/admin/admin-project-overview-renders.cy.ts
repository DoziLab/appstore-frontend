/// <reference path="../../support/index.d.ts" />

// admin-project-overview-renders
// ──────────────────────────────
// P1 success-path test: an admin on /admin/projects sees the global
// project/deployment overview — three stat cards plus the grouping view
// selector — populated from getAllDeployments(null).
//
// Why this test exists
//   AdminProjectOverview.tsx (route /admin/projects, gated by
//   <ProtectedRoute requireAdmin>) is the central admin monitoring surface
//   after the admin rework. On mount it calls getAllDeployments(null) which
//   hits GET /api/v1/deployments WITHOUT an openstack_project_id query — the
//   admin bypasses the per-project filter and sees every deployment across
//   all lecturers. The page derives three stat cards (Gesamt / Aktiv=running /
//   Inaktiv=non-running) and a "Ansicht wählen" selector that regroups the
//   list by lecturer / course / date. If the global fetch or the grouping
//   breaks, the admin loses the fleet-wide overview.
//
// deployment_parameters.teacher shape
//   extractTeacher() JSON.parses deployment.deployment_parameters (a STRING)
//   and reads parsed.teacher.{id,first_name,last_name,email}; the rendered
//   name is `${first_name} ${last_name}`, falling back to "Unbekannt" when the
//   field is missing/unparsable. The fixture therefore stores
//   deployment_parameters as a JSON string embedding a teacher object — this
//   matches the task hint.
//
// Fixture (deployments/admin-list.json)
//   Envelope { success, data:[...] } with 3 deployments: 2 running + 1 failed
//   → Gesamt 3, Aktiv 2, Inaktiv 1. Two distinct teachers (Petra Professorin
//   ×2 incl. the failed one, Dieter Dozent ×1) and three course.name values so
//   both the lecturer and course groupings have something to render. The
//   courses list is mockApi's default (empty), so extractCourse falls back to
//   deployment.course.name.

describe("Admin · project overview renders the global deployment fleet", () => {
  beforeEach(() => {
    // Default GETs (projects/quotas/deployments/courses/keycloak-groups/...)
    // so the admin shell bootstraps. We override the deployments list below.
    cy.mockApi();

    // getAllDeployments(null) → GET /api/v1/deployments with NO
    // openstack_project_id. The regex matches the bare path or a query string
    // but not deeper /deployments/<id> paths. Registered AFTER mockApi so it
    // wins on Cypress' reverse-registration stack.
    cy.intercept("GET", /\/api\/v1\/deployments(\?[^/]*)?$/, {
      fixture: "deployments/admin-list.json",
    }).as("getAdminDeployments");

    // getKeycloakGroups() hits the Keycloak admin REST API directly
    // (GET /admin/realms/{realm}/groups), not the backend proxy — intercept it
    // so the mount effect resolves instead of erroring.
    cy.intercept("GET", "**/admin/realms/*/groups*", {
      fixture: "keycloak/groups-direct.json",
    }).as("getKcAdminGroups");
  });

  it("shows stat cards and switches the grouping view, all from getAllDeployments(null)", () => {
    cy.loginAs("admin", "/admin/projects");

    // The fleet-wide fetch is the load-bearing request for this page.
    // Waiting on it proves the GET fired AND asserts the admin variant sends
    // no openstack_project_id filter.
    cy.wait("@getAdminDeployments")
      .its("request.url")
      .should("not.include", "openstack_project_id");

    // Header.
    cy.contains("h1", "Projektübersicht").should("be.visible");

    // Three stat cards. Gesamt reflects the 3 fixture rows, Aktiv the 2
    // running, Inaktiv the 1 failed. Scope the count assertion to each card
    // so we prove the label ↔ number pairing rather than "some 3 on screen".
    cy.contains("p", "Gesamte Deployments")
      .parent()
      .should("contain.text", "3");
    cy.contains("p", "Aktive Deployments")
      .parent()
      .should("contain.text", "2");
    cy.contains("p", "Inaktive Deployments")
      .parent()
      .should("contain.text", "1");

    // Default "Nach Dozent" view: teacher names extracted from
    // deployment_parameters.teacher are the grouping rows. Deployment NAMES
    // are NOT shown in this aggregate view — that is the tell that lets us
    // prove the date view later actually changes the grouping.
    cy.get('select[aria-label="Ansicht wählen"]').should("have.value", "lecturer");
    cy.contains("Petra Professorin").should("be.visible");
    cy.contains("Dieter Dozent").should("be.visible");
    cy.contains("admin-deploy-alpha").should("not.exist");

    // Switch to "Nach Kurs": rows are now course names (from course.name,
    // since the courses list is empty). The "Kurs" column header appears and
    // the individual course names render.
    cy.get('select[aria-label="Ansicht wählen"]').select("course");
    cy.contains("th", "Kurs").should("be.visible");
    cy.contains("Kurs Alpha").should("be.visible");
    cy.contains("Kurs Beta").should("be.visible");

    // Switch to "Nach Datum": the list flattens to individual deployments
    // sorted by date, so the per-deployment NAME now appears — grouping-
    // specific proof distinct from the lecturer/course aggregates.
    cy.get('select[aria-label="Ansicht wählen"]').select("date");
    cy.contains("admin-deploy-alpha").should("be.visible");
    cy.contains("admin-deploy-gamma").should("be.visible");
    // The failed row's status is surfaced only in the date view's Status cell.
    cy.contains("failed").should("be.visible");
  });
});
