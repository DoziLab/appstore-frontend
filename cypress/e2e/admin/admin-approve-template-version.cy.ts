/// <reference path="../../support/index.d.ts" />

// admin-approve-template-version
// ──────────────────────────────
// P0 success-path test: an admin on /admin sees the Template-Freigaben card
// populated with pending public template-versions (loaded via GET
// /api/v1/template-versions/queue). Clicking "Schnell genehmigen" on a row
// must fire POST /api/v1/template-versions/<id>/approve and the row must
// disappear from the queue UI on success.
//
// Why this test exists
//   The approval flow is the only path that turns a freshly imported public
//   template-version from "pending" into the AppStore's deployable catalogue
//   (TemplateVersionApprovalStatus = approved). If it breaks silently, pending
//   versions pile up indefinitely and the AppStore stops growing — both real
//   user-visible regressions.
//
//   AdminMonitoring.tsx renders one card per pending TemplateVersionQueueItem
//   (template name + version pill + "Schnell genehmigen" / "Details prüfen"
//   buttons). handleApprove() calls approveTemplateVersion() from
//   src/api/github.ts and then removes the version from local state. The
//   per-row removal is the user-visible signal that the action succeeded.
//
// Fixture
//   queue-pending.json mirrors the QueueResponse shape from
//   src/api/github.ts:158 (data: TemplateVersionQueueItem[], pagination,
//   message). Two items so the test can prove the correct row is removed
//   while the other stays visible.

describe("Admin · approves a pending template-version from the queue", () => {
  beforeEach(() => {
    // mockApi wires the default GETs (projects/quotas/deployments/templates/
    // courses/keycloak-groups/flavors) so the admin landing page bootstraps
    // cleanly. The queue endpoint is GET /api/v1/template-versions/queue —
    // mockApi's "/api/v1/template-versions*" glob does NOT cross the
    // segment boundary (Cypress URL globs use minimatch, where `*` does not
    // match `/`), so the queue fetch falls through. We register an explicit
    // regex intercept here that covers `/template-versions/queue?...` and
    // wins on the registration stack.
    cy.mockApi();
    cy.intercept("GET", /\/api\/v1\/template-versions\/queue(\?.*)?$/, {
      fixture: "template-versions/queue-pending.json",
    }).as("getQueuePending");

    // Approve endpoint — match any version-id. Backend returns the standard
    // envelope; an empty data body is enough for handleApprove (it only
    // checks the throw path).
    cy.intercept(
      "POST",
      "/api/v1/template-versions/*/approve",
      { statusCode: 200, body: { success: true, message: "ok", data: null } },
    ).as("approveVersion");
  });

  it("clicks 'Schnell genehmigen' on the first pending version and the row disappears", () => {
    cy.loginAs("admin", "/admin");

    // The queue load is the load-bearing fetch for the Template-Freigaben
    // card. Waiting on it proves the GET fired AND that the response landed
    // before we assert on the rendered rows.
    cy.wait("@getQueuePending");

    // Both pending versions from the fixture must be rendered as their own
    // cards inside the Template-Freigaben section. We anchor on the template
    // name from the queue item's inline `template.name`.
    cy.contains("WordPress Lab").should("be.visible");
    cy.contains("Nextcloud Workshop").should("be.visible");

    // Defensive: pre-register a queue-empty intercept BEFORE the click so
    // that even if the page were to refetch the queue after approve, the
    // refetched body would return zero rows. (Current AdminMonitoring.tsx
    // does the row removal via local state in handleApprove, so no refetch
    // actually happens — but registering this keeps the test honest if the
    // contract evolves to include a refetch.)
    cy.intercept("GET", /\/api\/v1\/template-versions\/queue(\?.*)?$/, {
      fixture: "template-versions/queue-empty.json",
    }).as("getQueueEmpty");

    // Click the "Schnell genehmigen" button scoped to the WordPress row.
    // The button text is exact (AdminMonitoring.tsx line ~900). We scope to
    // the row by locating the template-name <h3> and walking up to the
    // surrounding Card (`data-slot="card"`) — both pending rows render the
    // same button text, so unscoped cy.contains would race between them.
    cy.contains("h3", "WordPress Lab")
      .closest('[data-slot="card"]')
      .within(() => {
        cy.contains("button", "Schnell genehmigen").click();
      });

    // The POST must fire against /approve with the correct version id from
    // the fixture. The intercept above matched a glob; we narrow the URL
    // assertion here so a regression that hits the wrong version (or the
    // reject endpoint instead) is caught.
    cy.wait("@approveVersion").its("request.url").should("include", "/api/v1/template-versions/tv-pending-1/approve");

    // The approved row must be gone from the DOM. handleApprove filters it
    // out of pendingVersions immediately, so the WordPress Lab card vanishes.
    cy.contains("WordPress Lab").should("not.exist");

    // The OTHER pending row must still be visible — proves we approved the
    // correct one rather than emptying the entire list.
    cy.contains("Nextcloud Workshop").should("be.visible");
  });
});
