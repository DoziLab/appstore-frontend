/// <reference path="../../support/index.d.ts" />

// lecturer-management-lists
// ─────────────────────────
// P1 success-path test for the admin Lecturer-Verwaltung.
//
// Why this test exists
//   /admin/lecturers (src/pages/LecturerManagement.tsx) is the admin's only
//   window into "who owns resources" and the entry point for the cascade
//   delete of an account. Two fetches carry the whole surface:
//     • GET /api/v1/lecturers?skip=0&limit=50  → the table rows
//     • GET /api/v1/lecturers/{id}             → the detail dialog, fired
//       when a row is clicked (LecturerDetailDialog.tsx loadDetail()).
//   If either fetch or its render pipeline regresses, the admin is blind:
//   no user list, or an empty detail dialog before a destructive delete.
//
// Fixture notes
//   - lecturers/list.json is the LecturersResponse envelope with four rows;
//     the first is "Eve Stark" (id "lec-1"), the second "Jan Mueller".
//     pagination.total_items = 4 (single page, so no pager controls).
//   - lecturers/detail-1.json is the LecturerDetailResponse for "lec-1" with
//     a couple of templates/deployments/openstack_projects so all three
//     ResourceSection headers render with content.
//
// Intercept layering
//   The list regex `/\/api\/v1\/lecturers(\?.*)?$/` matches the bare listing
//   (with or without a query string) but NOT `/lecturers/lec-1` — that path
//   has a trailing segment. The detail intercept `/api/v1/lecturers/*` only
//   matches the sub-path. So the two never collide and each keeps its own
//   alias. mockApi() registers no lecturers endpoint, so both are set here.

describe("Admin · Lecturer-Verwaltung (Liste + Detail-Dialog)", () => {
  beforeEach(() => {
    cy.mockApi();
    cy.intercept("GET", /\/api\/v1\/lecturers(\?.*)?$/, {
      fixture: "lecturers/list.json",
    }).as("getLecturers");
    cy.intercept("GET", "/api/v1/lecturers/*", {
      fixture: "lecturers/detail-1.json",
    }).as("getLecturerDetail");
  });

  it("lädt die Tabelle und öffnet den Detail-Dialog per Zeilenklick", () => {
    cy.loginAs("admin", "/admin/lecturers");

    // Block until the list call resolves so the rows are painted.
    cy.wait("@getLecturers");

    // Page header + table headers prove the list surface rendered.
    cy.contains("h1", "Dozenten-Verwaltung").should("be.visible");
    cy.contains("th", "Name").should("be.visible");
    cy.contains("th", "Email").should("be.visible");
    cy.contains("th", "Letzter Login").should("be.visible");
    cy.contains("th", "Templates").should("be.visible");
    cy.contains("th", "Deployments").should("be.visible");
    cy.contains("th", "OSPs").should("be.visible");

    // Rows populated from the fixture.
    cy.contains("Eve Stark").should("be.visible");
    cy.contains("Jan Mueller").should("be.visible");

    // Click the first lecturer's row → detail fetch fires for that id.
    cy.contains("tr", "Eve Stark").click();
    cy.wait("@getLecturerDetail")
      .its("request.url")
      .should("match", /\/api\/v1\/lecturers\/lec-1$/);

    // Dialog opened with all three resource sections and the destructive
    // action. The dialog title repeats the lecturer's display name.
    cy.contains("h4", "Templates").should("be.visible");
    cy.contains("h4", "Deployments").should("be.visible");
    cy.contains("h4", "OpenStack-Projekte").should("be.visible");
    cy.contains("Ubuntu Basis").should("be.visible");
    cy.contains("eve-kurs-ss26").should("be.visible");
    cy.contains("eve-project").should("be.visible");
    cy.contains("button", "Account löschen").should("be.visible");
    cy.contains("button", "Schließen").should("be.visible");
  });
});
