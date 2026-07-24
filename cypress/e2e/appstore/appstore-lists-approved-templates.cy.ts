/// <reference path="../../support/index.d.ts" />

// appstore-lists-approved-templates
// ─────────────────────────────────
// P0 success-path test: a lecturer who opens /appstore must see the approved
// templates rendered as cards, each with its own Deploy button. The list
// originates from GET /api/v1/templates*, which AppStore.tsx fetches on mount
// via getTemplates({ status: "approved", page_size: 100 }).
//
// Why this test exists
//   /appstore is the central discovery surface — without a working template
//   grid + per-card Deploy button no lecturer can start a new deployment.
//   The page wires together three things that must all hold for a successful
//   render: (1) the GET /api/v1/templates request is fired, (2) the envelope's
//   `data: TemplateDto[]` is unwrapped and stored in state, (3) each entry is
//   rendered into a Card with name, description and an enabled Deploy button
//   (only enabled when ≥1 active version exists). Asserting all three in one
//   spec pins the happy path end to end and would catch regressions in either
//   the fetch wiring, the envelope unwrap, or the card-rendering loop.
//
// Fixture notes
//   We rely on the enriched templates/approved-list.json (3 public templates:
//   wordpress-demo, jupyter-stack, react-starter) which is also the default
//   served by cy.mockApi for @getTemplates. Each entry has exactly one active,
//   approved version so the Deploy button is enabled (AppStore.tsx disables it
//   when activeVersions.length === 0).

describe("AppStore · lists approved templates", () => {
  beforeEach(() => {
    // mockApi serves templates/approved-list.json by default for the
    // /api/v1/templates* alias — that's exactly the enriched fixture we need,
    // so no per-spec override is required. getProjects/single.json gets the
    // lecturer past App.tsx's project gate so /appstore actually mounts.
    cy.mockApi();
  });

  it("renders a Deploy card for each approved template", () => {
    cy.loginAs("lecturer", "/appstore");

    // Block until the template fetch fires — proves AppStore.tsx actually
    // called getTemplates({status:'approved'}) on mount, and gives Cypress
    // a deterministic point to assert against afterwards.
    cy.wait("@getTemplates");

    // Page heading + subtitle render unconditionally at the top of AppStore.tsx.
    // Pinning them anchors that we're on the right page and that we got past
    // the loading state ("Templates werden geladen...") that's rendered while
    // isLoading is true.
    cy.contains("h1", "App Store").should("be.visible");
    cy.contains("Templates werden geladen...").should("not.exist");

    // Each fixture template name must end up in the DOM. Hitting all three
    // catches a regression that silently drops items in the .map() loop or
    // breaks the envelope unwrap (response.data).
    cy.contains("wordpress-demo").should("be.visible");
    cy.contains("jupyter-stack").should("be.visible");
    cy.contains("react-starter").should("be.visible");

    // Per-card Deploy button. AppStore.tsx renders the deploy CTA with the
    // literal label "Deploy" (line 348). With three templates we expect
    // exactly three Deploy buttons in the grid — one per card. Filtering
    // on the exact text avoids matching the "Jetzt deployen" CTA inside the
    // details modal (which only mounts on demand and uses a different label).
    cy.get("button")
      .filter((_, el) => el.textContent?.trim() === "Deploy")
      .should("have.length", 3)
      .and("not.be.disabled");

    // Sanity: the error path must not also be rendered. AppStore.tsx surfaces
    // "Fehler beim Laden" only when the fetch rejects — its absence proves
    // we're on the success branch end to end.
    cy.contains("Fehler beim Laden").should("not.exist");
  });
});
