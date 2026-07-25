/// <reference path="../../support/index.d.ts" />

// admin-reject-template-with-reason
// ─────────────────────────────────
// P1 success-path test: an admin on /admin/templates rejects a pending public
// template-version WITH a typed reason. The rejection must fire
// POST /api/v1/template-versions/<id>/reject with { reason } in the body, and
// the rejected row must disappear from the queue UI while the other pending
// row stays visible.
//
// Why this test exists
//   Without a working reject-with-reason flow, template authors (Dozenten) get
//   no feedback about WHY their version was rejected — the rejection_reason is
//   what the version overview shows them so they can submit a correction.
//   Breaking this silently leaves authors stuck.
//
// ACTUAL reject interaction (verified against AdminTemplateApprovals.tsx)
//   The reject flow is a TWO-STEP inline interaction, NOT an immediate POST and
//   NOT a modal dialog:
//     1. Each pending card starts with an "Ablehnen" button (+ "Schnell
//        genehmigen"). Clicking "Ablehnen" only sets selectedVersionId — it
//        reveals an inline <textarea> (placeholder "z. B. Heat-Template …") and
//        swaps the action buttons to: "Abbrechen", "Ablehnen" (now the submit),
//        "Genehmigen".
//     2. You type the reason into the textarea, then click "Ablehnen" AGAIN —
//        this second click calls handleReject(version.id) → rejectTemplateVersion.
//   handleReject sends rejectionReason.trim() || undefined, i.e. the reason key
//   is only present in the POST body when non-empty (github.ts:226 — body is
//   JSON.stringify(reason ? { reason } : {})). Since we type a reason, the body
//   is { reason: "<typed>" }. On success the version is filtered out of local
//   state (no queue refetch), so the card vanishes.
//
// Fixture
//   Reuses template-versions/queue-pending.json (two items: "WordPress Lab"
//   tv-pending-1, "Nextcloud Workshop" tv-pending-2) so we can prove the
//   correct row is rejected while the other stays.

describe("Admin · rejects a pending template-version with a typed reason", () => {
  const REASON = "Heat-Template referenziert undefinierten Parameter X";

  beforeEach(() => {
    // mockApi wires the default bootstrap GETs (templates/flavors/etc). The
    // queue endpoint GET /api/v1/template-versions/queue is NOT covered by
    // mockApi's glob (Cypress minimatch `*` doesn't cross `/`), so we register
    // an explicit regex intercept that wins on the registration stack.
    cy.mockApi();
    cy.intercept("GET", /\/api\/v1\/template-versions\/queue(\?.*)?$/, {
      fixture: "template-versions/queue-pending.json",
    }).as("getQueuePending");

    // Reject endpoint — match any version-id. Standard envelope response.
    cy.intercept(
      "POST",
      "/api/v1/template-versions/*/reject",
      {
        statusCode: 200,
        body: {
          success: true,
          message: "ok",
          data: null,
          errors: null,
          timestamp: "2026-07-25T00:00:00Z",
          request_id: "req-rej",
        },
      },
    ).as("rejectVersion");
  });

  it("opens the reason textarea, submits, and the POST carries the reason while the row disappears", () => {
    cy.loginAs("admin", "/admin/templates");

    // The queue load is load-bearing for the Template-Freigaben card.
    cy.wait("@getQueuePending");

    // Both pending versions render as their own cards.
    cy.contains("WordPress Lab").should("be.visible");
    cy.contains("Nextcloud Workshop").should("be.visible");

    // Scope to the WordPress row by walking from the template-name <h3> up to
    // the surrounding per-version Card (data-slot="card"). Both rows share the
    // same button text, so scoping avoids a race.
    cy.contains("h3", "WordPress Lab")
      .closest('[data-slot="card"]')
      .within(() => {
        // Step 1: reveal the rejection textarea (sets selectedVersionId).
        cy.contains("button", "Ablehnen").click();

        // Step 2: type the reason, then submit via the (now-)submit "Ablehnen".
        cy.get("textarea").type(REASON);
        cy.contains("button", "Ablehnen").click();
      });

    // The POST must hit /reject for the correct version id and carry the reason
    // in the body. Narrow the URL beyond the glob so a regression hitting the
    // wrong version (or /approve) is caught.
    cy.wait("@rejectVersion").then((interception) => {
      expect(interception.request.url).to.include(
        "/api/v1/template-versions/tv-pending-1/reject",
      );
      expect(interception.request.body).to.deep.include({ reason: REASON });
    });

    // handleReject filters the version out of local state on success, so the
    // WordPress Lab card must be gone.
    cy.contains("WordPress Lab").should("not.exist");

    // The other pending row must still be visible — proves we rejected the
    // correct one rather than clearing the whole list.
    cy.contains("Nextcloud Workshop").should("be.visible");
  });
});
