/// <reference path="../../support/index.d.ts" />

// wizard-step0-validates-deployment-name
// ───────────────────────────────────────
// P0 edge-case test for the Deployment-Name validation in step 0 of the
// DeploymentWizard ("Template & Zugriff").
//
// Why this test exists
//   The Deployment-Name flows into the OpenStack Heat stack name that the
//   backend ultimately deploys. DeploymentWizard.tsx mirrors the backend's
//   sanitization rules client-side: as the user types, umlauts (ä/ö/ü/ß)
//   collapse to ae/oe/ue/ss, casing is normalized to lowercase, and runs of
//   spaces/underscores become hyphens (see sanitizeDeploymentName). On top
//   of that, validateDeploymentNamePattern enforces the DNS-1123-style
//   regex /^[a-z][a-z0-9-]{0,54}$/ — characters the sanitizer DOESN'T
//   rewrite (e.g. "!") still fail the regex and surface a validation error
//   that disables the step's two parallel continue buttons ("Detaillierte
//   Konfiguration" and "Direkt zur Übersicht").
//
//   Without this guard, malformed names slip through to the backend and
//   either produce a cryptic 400 from the deploy endpoint or — worse —
//   break Heat stack creation downstream. The test pins both halves of the
//   contract:
//     (1) live sanitization mutates the input value as the user types, and
//     (2) the buttons stay disabled until the sanitized value is also
//         pattern-valid AND a course (group) has been picked.
//
// What's asserted
//   - Typing "Test Üben!" yields a live-sanitized input value "test-ueben!"
//     (umlaut + space normalized) but the trailing "!" leaves the pattern
//     invalid → "Detaillierte Konfiguration" is disabled.
//   - Replacing the value with "my-deploy-1" and picking a Keycloak group
//     keeps the sanitized value as-typed and enables "Detaillierte
//     Konfiguration".
//   - Clicking the now-enabled button advances the wizard past step 0
//     (the Übersicht heading "Deployment-Zusammenfassung" appears, since
//     the test template has no parameters and no user files → step 1 is
//     the overview).

describe("DeploymentWizard · Step 0 validates the deployment name", () => {
  beforeEach(() => {
    cy.mockApi();

    // Wizard mount fetches: template detail + versions list. The active
    // version (tv-wp-1) is auto-selected, which triggers a second fetch
    // for that version's parameters/user_files. We answer all three with
    // wordpress fixtures so the wizard settles into a clean step-0 state.
    cy.intercept("GET", "/api/v1/templates/tpl-wp-0001", {
      fixture: "templates/detail-wordpress.json",
    }).as("getTemplateDetail");
    cy.intercept(
      "GET",
      "/api/v1/template-versions/template/tpl-wp-0001*",
      { fixture: "template-versions/list-wordpress.json" },
    ).as("getTemplateVersionsForTemplate");
    cy.intercept(
      "GET",
      "/api/v1/template-versions/tv-wp-1*",
      { fixture: "template-versions/version-detail-wordpress.json" },
    ).as("getTemplateVersionDetail");

    // Keycloak groups are fetched directly against authServerUrl, NOT via
    // /api/v1/*. We need at least one group so the Kurs-Select renders an
    // option the user can pick — the second continue button "Direkt zur
    // Übersicht" gates on selectedKeycloakGroupId among other fields.
    cy.intercept("GET", "**/admin/realms/*/groups*", {
      fixture: "keycloak/groups-direct.json",
    }).as("getKeycloakGroupsDirect");

    // Group members fetch fires once a group is selected. Returning an
    // empty array sidesteps the per_group "no empty groups" validation
    // (default deploymentMode is "per_group"; with zero members the extra
    // group-assignment checks in isStep0ValidPure are skipped entirely),
    // keeping this spec focused on the name-validation path.
    cy.intercept("GET", "**/admin/realms/*/groups/*/members*", {
      body: [],
    }).as("getKeycloakGroupMembers");
  });

  it("disables Continue while the name fails the DNS-1123 pattern, enables it once the name is valid and a group is picked", () => {
    cy.loginAs("lecturer", "/deploy/tpl-wp-0001");

    // Wait for the wizard to mount and settle on step 0.
    cy.wait("@getTemplateDetail");
    cy.wait("@getTemplateVersionsForTemplate");
    cy.contains("Template & Zugriff").should("be.visible");

    const continueButton = () =>
      cy.contains("button", "Detaillierte Konfiguration");

    // Before any input: name is empty → validationErrors include the
    // "required" message → Continue is disabled.
    continueButton().should("be.disabled");

    // ── Invalid input ────────────────────────────────────────────────
    // "Test Üben!" exercises both sanitizer branches (Ü → ue, space → "-",
    // uppercase → lowercase) AND leaves an offending "!" that the
    // sanitizer does NOT rewrite. The live-sanitized value becomes
    // "test-ueben!" which still fails /^[a-z][a-z0-9-]{0,54}$/, so the
    // continue button must stay disabled.
    cy.get("#deployment-name").clear().type("Test Üben!");
    cy.get("#deployment-name").should("have.value", "test-ueben!");

    // The validation error renders inline (red bullet) — its presence is
    // a stronger guarantee than just checking the disabled attr, because
    // it proves the pattern check actually fired on this input rather
    // than the button being disabled for some unrelated reason.
    cy.contains(/muss mit einem Kleinbuchstaben beginnen/i).should(
      "be.visible",
    );
    continueButton().should("be.disabled");

    // ── Valid input ──────────────────────────────────────────────────
    // "my-deploy-1" matches the pattern exactly and the sanitizer leaves
    // it untouched. The Continue button still needs a course selection
    // before it enables (validateStep0 also checks selectedKeycloakGroupId).
    cy.get("#deployment-name").clear().type("my-deploy-1");
    cy.get("#deployment-name").should("have.value", "my-deploy-1");

    // Pick the single Keycloak group we mocked. The select is a Radix
    // primitive — open the trigger by its current "z.B. WWI23SEB"
    // placeholder, then click the option.
    cy.wait("@getKeycloakGroupsDirect");
    cy.contains("label", /Kurs auswählen/i)
      .parent()
      .find('[role="combobox"]')
      .click();
    cy.get('[role="option"]').contains("Test-Gruppe").click();

    // Group is selected → members fetch fires → returns []. Wizard now
    // satisfies all step-0 requirements: name pattern-valid, version
    // auto-selected, group selected, no per_group complications because
    // there are no members to bucket.
    cy.wait("@getKeycloakGroupMembers");
    continueButton().should("not.be.disabled");

    // Advance: with empty parameters/user_files in the fixture, step 1
    // IS the Übersicht. Its distinctive heading proves the wizard moved
    // forward — covers the full "valid input flips button → click works"
    // round-trip.
    continueButton().click();
    cy.contains("Deployment-Zusammenfassung").should("be.visible");
  });
});
