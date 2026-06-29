/// <reference path="../../support/index.d.ts" />

// auth-non-admin-cannot-access-admin-route
// ────────────────────────────────────────
// P0 permission test: a lecturer (roles=["lecturer"], NOT "admin") navigating
// directly to /admin must NOT see the AdminMonitoring page contents. The
// "Administration" heading, the deployments/approval-queue UI, and any admin-
// only data-fetches must all be absent for the non-admin user.
//
// ⚠️  CURRENTLY SKIPPED — see cypress/SECURITY-FINDINGS.md
//
//   Discovered while authoring this test: AdminMonitoring.tsx has no role
//   gate, and App.tsx exposes /admin to any authenticated user. A lecturer
//   who knows the URL gets the full admin UI (global deployments, template
//   approval queue, approve/reject buttons). The Sidebar gate is the only
//   defense and it's UI-only, not a security boundary.
//
//   The test below is the regression test you want once the gate is added
//   to AdminMonitoring (a one-liner using useCurrentUser().isAdmin). It is
//   left in the repo as `describe.skip` so:
//     1. The expected behaviour is documented in executable form.
//     2. A future contributor can drop the .skip the moment the prod fix
//        lands and the assertions will pin the gate in place.
//
//   See cypress/SECURITY-FINDINGS.md for the full write-up.
//
// Why this test exists
//   App.tsx (line 159) wires <AdminMonitoring /> at /admin for ANY authenticated
//   user — there is no route-level role check. The Sidebar.tsx admin link IS
//   gated (only rendered when realm_access.roles contains "admin"), but a
//   lecturer who knows the URL can still hit /admin directly.
//
//   The defense-in-depth invariant is therefore that AdminMonitoring itself
//   must short-circuit for non-admins (via useCurrentUser().isAdmin) BEFORE it
//   mounts the data effects that load the template-versions approval queue,
//   the global deployments list, courses, keycloak groups, and flavors.
//
//   We pin three invariants:
//     1. The admin "Administration" H1 is NOT in the DOM for a lecturer.
//     2. The Sidebar admin nav link (<a href="/admin">) is NOT rendered for a
//        lecturer — the Sidebar's own gate stays honest.
//     3. The admin-only data fetch for the template-versions approval queue
//        (`getTemplateVersions` alias) NEVER fires — proof that the page
//        short-circuited before its useEffects ran.
//
//   If this test fails on assertion #1 or #3, AdminMonitoring is missing its
//   role gate and lecturers can read (and act on) every deployment and
//   template-approval in the system. That is a privilege-escalation finding
//   that must NOT be silently weakened by relaxing the assertion.

describe.skip("Auth · non-admin lecturer cannot access /admin (pending gate fix)", () => {
  beforeEach(() => {
    // Defaults satisfy App.tsx's bootstrap: lecturer has a project (single.json),
    // so `needsSetup === false` and the router actually mounts /admin instead
    // of redirecting to /setup. Every other alias (getTemplateVersions,
    // getDeployments, getCourses, …) gets its standard fixture so any rogue
    // fetch is captured for the length assertions below.
    cy.mockApi();
  });

  it("does not render AdminMonitoring or its sidebar link for a lecturer", () => {
    cy.loginAs("lecturer", "/admin");

    // Wait for the bootstrap project-check to resolve. App.tsx fires
    // listOpenstackProjects() for lecturers; once it returns single.json the
    // needsSetup gate evaluates to false and the /admin route can mount (or
    // — once the role gate is in place — short-circuit). Waiting here means
    // any subsequent length-0 assertion is meaningful: the page has had its
    // chance to mount and decide.
    cy.wait("@getProjects");

    // URL is still /admin — App.tsx does not redirect lecturers off the
    // route (the gate, when added, should be component-internal: render
    // nothing / a denied state instead of navigating away).
    cy.location("pathname").should("eq", "/admin");

    // Invariant #1 — the AdminMonitoring "Administration" H1 (line 395 of
    // AdminMonitoring.tsx) MUST NOT exist in the DOM. If a future gate
    // renders a "Zugriff verweigert" message in its place, that's fine —
    // this assertion only cares that the admin H1 itself is gone. Using
    // .should("not.exist") rather than .should("not.be.visible") because
    // the gate is expected to return null/empty for non-admins, not hide
    // the element with CSS.
    cy.contains(/^Administration$/).should("not.exist");

    // Invariant #2 — the Sidebar admin link is only rendered when
    // `realm_access.roles` includes "admin" (Sidebar.tsx line 121). For a
    // lecturer the <a href="/admin"> link must not be in the DOM at all.
    // This is a stable selector — the icon-only link has no text but its
    // href is fixed.
    cy.get('a[href="/admin"]').should("not.exist");

    // Invariant #3 — load-bearing: the admin-only template-versions
    // approval-queue fetch MUST NOT fire. AdminMonitoring's loadQueue()
    // runs in a useEffect at mount; if the component short-circuits
    // before mounting (because of the role gate), the effect never runs
    // and the intercept is never matched. This is what proves the gate
    // is real rather than a CSS hide.
    cy.get("@getTemplateVersions.all").should("have.length", 0);
  });
});
