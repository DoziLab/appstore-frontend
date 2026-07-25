/// <reference path="../../support/index.d.ts" />

// lecturer-delete-cascade-poll
// ────────────────────────────
// P1 success-path test for the admin Lecturer cascade-delete flow.
//
// Why this test exists
//   Deleting a lecturer (src/pages/LecturerManagement.tsx →
//   LecturerDetailDialog.tsx → DeleteLecturerConfirmDialog.tsx) is the single
//   most destructive admin action: it cascades over deployments (incl. Heat
//   stacks), templates + versions and OpenStack-project rows before removing
//   the user. The action is asynchronous — DELETE returns 202 + a Celery task
//   id, and the UI only knows it succeeded once GET /lecturers/{id} answers
//   404. Two safety mechanisms must hold:
//     • the type-to-confirm gate (DeleteLecturerConfirmDialog): the destructive
//       button stays disabled until the admin types the exact confirmation
//       name (display_name || username || email || id — here "Eve Stark").
//     • the post-delete poll (LecturerDetailDialog.startPolling): every 2000ms
//       it re-fetches the detail; a 404 = success → success toast + list
//       refetch (onDeleted) + modal close.
//   If either regresses the admin either deletes without a real confirmation,
//   or is left without feedback while a destructive job runs.
//
// Intercept layering / poll simulation
//   Cypress evaluates intercepts in reverse-registration order (last wins).
//   We first serve GET /api/v1/lecturers/lec-1 from the detail fixture so the
//   dialog opens with a 200. After DELETE we RE-register the same GET to 404 —
//   the next 2000ms poll then hits it and drives the success path. The success
//   assertion uses an increased timeout to span the poll interval; that is an
//   assertion timeout (allowed), not a fixed cy.wait(<number>).

describe("Admin · Lecturer Cascade-Delete (Confirm + Poll bis 404)", () => {
  beforeEach(() => {
    cy.mockApi();

    // Table listing (bare path, with/without query) — never matches /lec-1.
    cy.intercept("GET", /\/api\/v1\/lecturers(\?.*)?$/, {
      fixture: "lecturers/list.json",
    }).as("getLecturers");

    // Detail fetch for the opened dialog — 200 with the full resource fixture.
    cy.intercept("GET", "/api/v1/lecturers/lec-1", {
      fixture: "lecturers/detail-1.json",
    }).as("getLecturerDetail");

    // Async cascade-delete: 202 Accepted + task id (LecturerDeleteResponse).
    cy.intercept("DELETE", "/api/v1/lecturers/lec-1", {
      statusCode: 202,
      body: {
        success: true,
        message: "enqueued",
        data: {
          task_id: "task-123",
          user_id: "lec-1",
          deployment_count: 1,
          template_count: 2,
        },
        errors: null,
        timestamp: "2026-07-25T00:00:00Z",
        request_id: "req-del",
      },
    }).as("deleteLecturer");
  });

  it("bestätigt per Namen, sendet DELETE 202 und pollt bis 404 = Erfolg", () => {
    cy.loginAs("admin", "/admin/lecturers");
    cy.wait("@getLecturers");

    // Open the detail dialog for Eve Stark (lec-1).
    cy.contains("tr", "Eve Stark").click();
    cy.wait("@getLecturerDetail")
      .its("request.url")
      .should("match", /\/api\/v1\/lecturers\/lec-1$/);

    // Enter the confirm sub-dialog.
    cy.contains("button", "Account löschen").click();
    cy.contains("Lecturer-Account löschen?").should("be.visible");

    // Type-to-confirm gate: button disabled until the exact name is typed.
    // expected = display_name || username || email || id  → "Eve Stark".
    cy.contains("button", "Endgültig löschen").should("be.disabled");
    cy.get("#lecturer-confirm-name").type("Eve Stark");
    cy.contains("button", "Endgültig löschen").should("not.be.disabled");
    cy.contains("button", "Endgültig löschen").click();

    // DELETE fired and returned 202 → confirm dialog closes, poll begins.
    cy.wait("@deleteLecturer");

    // Polling started: the persistent "Cascade-Delete läuft…" box renders in
    // the still-open detail dialog. (The enqueue toast.info is transient and
    // auto-dismisses, so we anchor on the persistent box instead.)
    cy.contains("Cascade-Delete läuft").should("be.visible");

    // Now the account is gone: re-register the detail GET to 404. Registered
    // last, so the next 2000ms poll resolves against this and treats 404 as
    // the success signal.
    cy.intercept("GET", "/api/v1/lecturers/lec-1", {
      statusCode: 404,
      body: {
        success: false,
        message: "not found",
        data: null,
        errors: ["not found"],
        timestamp: "2026-07-25T00:00:00Z",
        request_id: "req-gone",
      },
    }).as("getLecturerGone");

    // Success toast fires once the poll sees the 404. Increased assertion
    // timeout spans the 2s poll interval (not a fixed wait).
    cy.contains("Lecturer-Account wurde gelöscht", { timeout: 10000 }).should(
      "be.visible",
    );

    // Modal closed on success (onDeleted → onOpenChange(false)).
    cy.contains("Cascade-Delete läuft").should("not.exist");
  });
});
