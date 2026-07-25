/// <reference path="../../support/index.d.ts" />

// course-filters-toggle-chip
// ──────────────────────────
// On /courses the admin-managed filter chips (loaded via listCourseFilters →
// GET /api/v1/course-filters) drive a CLIENT-SIDE filter of the course list.
// A lecturer toggles a chip and the list narrows: OR semantics across active
// chips, case-INSENSITIVE substring match against a course's resolved keycloak
// group name OR its course name (see Courses.tsx filteredCourses predicate).
//
// Only courses that HAVE deployments are ever shown, so the courses fixture
// gives every course at least one deployment. Two courses ("WWI21 SQL",
// "INF22 Web") are chosen so the "SQL" chip matches exactly one of them.
//
// NOTE: the displayed course title is the resolved keycloak GROUP name
// (keycloakGroupName), fetched directly from Keycloak's admin API
// (**/admin/realms/*/groups*), NOT the backend /api/v1/keycloak/groups proxy.
// We intercept that group call so name resolution is deterministic; here the
// group names equal the course names, so the substring match is unambiguous.

describe("Courses · filter chips narrow the list client-side", () => {
  beforeEach(() => {
    cy.mockApi();

    // Courses with deployments (so they render at all).
    cy.intercept("GET", "/api/v1/courses*", {
      fixture: "courses/list-with-deployments.json",
    }).as("getCourses");

    // Filter chips.
    cy.intercept("GET", "/api/v1/course-filters*", {
      fixture: "course-filters/list.json",
    }).as("getCourseFilters");

    // Keycloak group name resolution goes straight to the Keycloak admin API.
    cy.intercept("GET", "**/admin/realms/*/groups*", {
      fixture: "keycloak/groups-courses.json",
    }).as("getKeycloakAdminGroups");
  });

  it("toggles a chip to narrow the list, then 'Alle anzeigen' resets it", () => {
    cy.loginAs("lecturer", "/courses");
    cy.wait(["@getCourses", "@getCourseFilters"]);

    // Both courses (both have deployments) visible initially.
    cy.contains(".text-slate-900", "WWI21 SQL").should("be.visible");
    cy.contains(".text-slate-900", "INF22 Web").should("be.visible");

    // Filter bar + both chips render.
    cy.contains("Kurs-Filter:").should("be.visible");
    cy.contains("button", "SQL").should("have.attr", "aria-pressed", "false");
    cy.contains("button", "Web").should("exist");

    // Activate the "SQL" chip → only the SQL-matching course remains.
    cy.contains("button", "SQL").click();
    cy.contains("button", "SQL").should("have.attr", "aria-pressed", "true");
    cy.contains(".text-slate-900", "WWI21 SQL").should("be.visible");
    cy.contains(".text-slate-900", "INF22 Web").should("not.exist");

    // "Alle anzeigen" appears while a filter is active — clears the set.
    cy.contains("button", "Alle anzeigen").should("be.visible").click();
    cy.contains("button", "SQL").should("have.attr", "aria-pressed", "false");
    cy.contains(".text-slate-900", "WWI21 SQL").should("be.visible");
    cy.contains(".text-slate-900", "INF22 Web").should("be.visible");
  });
});
