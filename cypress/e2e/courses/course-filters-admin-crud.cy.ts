/// <reference path="../../support/index.d.ts" />

// course-filters-admin-crud
// ─────────────────────────
// On /courses an ADMIN gets the inline filter-management controls that a
// lecturer never sees (gated by useCurrentUser().isAdmin in Courses.tsx):
//   • a "Neuer Filter (z.B. SQL)" input + "Hinzufügen" button
//     (aria-label "Filter hinzufügen")
//   • per-chip pencil ("Filter <name> umbenennen") + X ("Filter <name> löschen")
//
// This spec drives the two mutations that keep the chip taxonomy in shape:
//   CREATE  POST   /api/v1/course-filters      body {name} ONLY  → 201
//   DELETE  DELETE /api/v1/course-filters/{id}                   → 200 data:null
// After each mutation Courses.tsx calls loadFilters() again (another GET
// /api/v1/course-filters), so we re-register the GET so the refetch reflects
// the mutated set: "Docker" appears after add, "Web" is gone after delete.
//
// The displayed course titles come from the Keycloak admin API
// (**/admin/realms/*/groups*), which we stub for determinism even though this
// spec only cares about the chip-bar.

// Two initial filters (SQL, Web) — mirrors course-filters/list.json.
function filtersEnvelope(data: Array<{ id: string; name: string }>) {
  return {
    success: true,
    message: "ok",
    data: data.map((f) => ({
      ...f,
      created_at: "2026-06-01T00:00:00Z",
      updated_at: "2026-06-01T00:00:00Z",
    })),
    pagination: {
      page: 1,
      page_size: 100,
      total_items: data.length,
      total_pages: 1,
    },
    errors: null,
    timestamp: "2026-07-25T00:00:00Z",
    request_id: "req-course-filters",
  };
}

const INITIAL = [
  { id: "cf-sql", name: "SQL" },
  { id: "cf-web", name: "Web" },
];

describe("Courses · admin can add and delete course filters", () => {
  beforeEach(() => {
    cy.mockApi();

    cy.intercept("GET", "/api/v1/courses*", {
      fixture: "courses/list-with-deployments.json",
    }).as("getCourses");

    cy.intercept("GET", "**/admin/realms/*/groups*", {
      fixture: "keycloak/groups-courses.json",
    }).as("getKeycloakAdminGroups");

    // Course filters GET. Re-registered mid-test to model the loadFilters()
    // refetch after each mutation (later intercepts win in Cypress).
    cy.intercept("GET", "/api/v1/course-filters*", {
      statusCode: 200,
      body: filtersEnvelope(INITIAL),
    }).as("getCourseFilters");

    // Create → 201 with the standard single-item envelope.
    cy.intercept("POST", "/api/v1/course-filters", {
      statusCode: 201,
      body: {
        success: true,
        message: "ok",
        data: {
          id: "cf-new",
          name: "Docker",
          created_at: "2026-07-25T00:00:00Z",
          updated_at: "2026-07-25T00:00:00Z",
        },
        errors: null,
        timestamp: "2026-07-25T00:00:00Z",
        request_id: "req-cf-add",
      },
    }).as("createFilter");

    // Delete → 200 with data:null.
    cy.intercept("DELETE", "/api/v1/course-filters/*", {
      statusCode: 200,
      body: {
        success: true,
        message: "ok",
        data: null,
        errors: null,
        timestamp: "2026-07-25T00:00:00Z",
        request_id: "req-cf-del",
      },
    }).as("deleteFilter");
  });

  it("adds a new filter (POST) and deletes an existing one (DELETE)", () => {
    cy.loginAs("admin", "/courses");
    cy.wait(["@getCourses", "@getCourseFilters"]);

    // Admin-only controls are visible.
    cy.get('input[placeholder="Neuer Filter (z.B. SQL)"]').should("be.visible");
    cy.get('[aria-label="Filter hinzufügen"]').should("be.visible");
    cy.get('[aria-label="Filter Web löschen"]').should("be.visible");
    cy.get('[aria-label="Filter SQL umbenennen"]').should("exist");

    // ── ADD ──────────────────────────────────────────────────────────────
    // The loadFilters() refetch after create must show the new chip.
    cy.intercept("GET", "/api/v1/course-filters*", {
      statusCode: 200,
      body: filtersEnvelope([...INITIAL, { id: "cf-new", name: "Docker" }]),
    }).as("getCourseFiltersAfterAdd");

    cy.get('input[placeholder="Neuer Filter (z.B. SQL)"]').type("Docker");
    cy.get('[aria-label="Filter hinzufügen"]').click();

    cy.wait("@createFilter").its("request.body").should("deep.equal", {
      name: "Docker",
    });

    cy.wait("@getCourseFiltersAfterAdd");
    cy.contains("button", "Docker").should("be.visible");

    // ── DELETE ───────────────────────────────────────────────────────────
    // The refetch after delete must drop the "Web" chip.
    cy.intercept("GET", "/api/v1/course-filters*", {
      statusCode: 200,
      body: filtersEnvelope([
        { id: "cf-sql", name: "SQL" },
        { id: "cf-new", name: "Docker" },
      ]),
    }).as("getCourseFiltersAfterDelete");

    cy.get('[aria-label="Filter Web löschen"]').click();

    cy.wait("@deleteFilter")
      .its("request.url")
      .should("include", "/api/v1/course-filters/cf-web");

    cy.wait("@getCourseFiltersAfterDelete");
    cy.contains("button", "Web").should("not.exist");
    // The surviving chips remain.
    cy.contains("button", "SQL").should("be.visible");
    cy.contains("button", "Docker").should("be.visible");
  });
});
