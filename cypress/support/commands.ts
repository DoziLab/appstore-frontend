/// <reference path="./index.d.ts" />

// Custom Cypress commands for the appstore-frontend integration tests.
//
// Design summary
// ──────────────
// - Keycloak is stubbed via a window-level hook (`__CYPRESS_KEYCLOAK_STUB__`)
//   read inside src/auth/keycloak.ts at module load. We MUST set that global
//   before the app bundle loads, so `cy.loginAs` does it via the visit
//   `onBeforeLoad` callback rather than `cy.window()`.
// - All API calls are intercepted as relative `/api/v1/...` paths (the prod
//   code calls them relative; Vite proxy forwards in dev). `cy.mockApi`
//   wires up the most common GET endpoints with sensible defaults. Per-spec
//   overrides win — Cypress evaluates intercepts in reverse-registration
//   order, so register override intercepts AFTER calling `cy.mockApi`.

type Role =
  | "lecturer"
  | "admin"
  | "unauthenticated"
  | "expiring"
  | "init-error";

type CypressKeycloakStub = {
  authenticated: boolean;
  token?: string;
  tokenParsed?: Record<string, any>;
  realm?: string;
  authServerUrl?: string;
  initRejects?: boolean;
  initDelayMs?: number;
};

type LoginAsOptions = {
  stubOverrides?: Partial<CypressKeycloakStub>;
  onBeforeLoad?: (win: Window) => void;
};

// ─── cy.stubKeycloak ─────────────────────────────────────────────────────────
//
// Loads the fixture for `role` and stashes the (possibly overridden) stub in
// `Cypress.env("keycloakStub")`. The NEXT call to `cy.visit` (typically via
// cy.loginAs) is responsible for installing it on `window` before the AUT
// bundle evaluates.
//
// In most cases prefer `cy.loginAs(role, url)` which combines the two steps.
Cypress.Commands.add(
  "stubKeycloak",
  (role: Role, overrides?: Partial<CypressKeycloakStub>) => {
    return cy
      .fixture(`keycloak/${role}.json`)
      .then((fixture: CypressKeycloakStub) => {
        const merged: CypressKeycloakStub = { ...fixture, ...(overrides ?? {}) };
        Cypress.env("keycloakStub", merged);
        return cy.wrap(merged, { log: false });
      });
  },
);

// ─── cy.loginAs ──────────────────────────────────────────────────────────────
//
// Primary entry point for specs. Loads the role fixture, then visits `url`
// with an `onBeforeLoad` that sets `window.__CYPRESS_KEYCLOAK_STUB__` BEFORE
// any app code runs — this is what makes the patched keycloak.ts mutate its
// singleton.
Cypress.Commands.add(
  "loginAs",
  (role: Role, url: string = "/", options: LoginAsOptions = {}) => {
    return cy
      .fixture(`keycloak/${role}.json`)
      .then((fixture: CypressKeycloakStub) => {
        const stub: CypressKeycloakStub = {
          ...fixture,
          ...(options.stubOverrides ?? {}),
        };
        return cy.visit(url, {
          onBeforeLoad(win) {
            (win as any).__CYPRESS_KEYCLOAK_STUB__ = stub;
            if (typeof options.onBeforeLoad === "function") {
              options.onBeforeLoad(win);
            }
          },
        });
      });
  },
);

// ─── cy.mockApi ──────────────────────────────────────────────────────────────
//
// Registers the default GET intercepts every spec usually needs. Each one
// is aliased so specs can `cy.wait("@getProjects")` etc. Specs can override
// individual endpoints AFTER calling cy.mockApi — later intercepts win.
//
// `overrides` is a map of alias → { fixture: string } | { body: any } |
// { statusCode, body } | full intercept handler. If omitted for an alias,
// the default fixture is used.
type InterceptOverride =
  | { fixture: string }
  | { body: any }
  | { statusCode: number; body?: any; fixture?: string }
  | ((req: any) => void);

type MockApiOverrides = Partial<Record<string, InterceptOverride>>;

function applyIntercept(
  method: string,
  url: string | RegExp,
  defaultFixture: string,
  alias: string,
  override: InterceptOverride | undefined,
) {
  if (typeof override === "function") {
    cy.intercept(method as any, url, override).as(alias);
    return;
  }
  if (override && "fixture" in override && override.fixture) {
    if ("statusCode" in override && override.statusCode != null) {
      cy.intercept(method as any, url, {
        statusCode: override.statusCode,
        fixture: override.fixture,
      }).as(alias);
    } else {
      cy.intercept(method as any, url, { fixture: override.fixture }).as(alias);
    }
    return;
  }
  if (override && "body" in override) {
    const sc =
      "statusCode" in override && override.statusCode != null
        ? override.statusCode
        : 200;
    cy.intercept(method as any, url, { statusCode: sc, body: override.body }).as(
      alias,
    );
    return;
  }
  if (override && "statusCode" in override) {
    cy.intercept(method as any, url, {
      statusCode: override.statusCode,
      body: override.body ?? {},
    }).as(alias);
    return;
  }
  cy.intercept(method as any, url, { fixture: defaultFixture }).as(alias);
}

Cypress.Commands.add("mockApi", (overrides: MockApiOverrides = {}) => {
  applyIntercept(
    "GET",
    "/api/v1/openstack-projects*",
    "openstack-projects/single.json",
    "getProjects",
    overrides.getProjects,
  );
  applyIntercept(
    "GET",
    "/api/v1/quotas*",
    "quotas/default.json",
    "getQuotas",
    overrides.getQuotas,
  );
  // Match /api/v1/deployments and /api/v1/deployments?... but NOT
  // /api/v1/deployments/<id> or deeper paths — those are spec-specific.
  applyIntercept(
    "GET",
    /\/api\/v1\/deployments(\?[^/]*)?$/,
    "deployments/empty.json",
    "getDeployments",
    overrides.getDeployments,
  );
  applyIntercept(
    "GET",
    "/api/v1/templates*",
    "templates/approved-list.json",
    "getTemplates",
    overrides.getTemplates,
  );
  // Cypress glob `*` does not cross `/`, so a single `template-versions*`
  // pattern would miss `/template-versions/queue?…`. Cover both the listing
  // path and the queue path with a regex.
  applyIntercept(
    "GET",
    /\/api\/v1\/template-versions(\/queue)?(\?.*)?$/,
    "template-versions/queue-empty.json",
    "getTemplateVersions",
    overrides.getTemplateVersions,
  );
  applyIntercept(
    "GET",
    "/api/v1/courses*",
    "courses/list.json",
    "getCourses",
    overrides.getCourses,
  );
  applyIntercept(
    "GET",
    "/api/v1/keycloak/groups*",
    "keycloak-groups/list.json",
    "getKeycloakGroups",
    overrides.getKeycloakGroups,
  );
  // The real flavors endpoint is `/api/v1/openstack/flavors`, not
  // `/api/v1/flavors`. Match either so older specs and new ones both work.
  applyIntercept(
    "GET",
    /\/api\/v1\/(openstack\/)?flavors(\?.*)?$/,
    "flavors/list.json",
    "getFlavors",
    overrides.getFlavors,
  );
});

// ─── cy.expectNoRequest ──────────────────────────────────────────────────────
//
// Asserts that an intercept alias was never matched. Cypress always defines
// the alias once registered, but `interception.calls` (the list of matched
// requests) stays empty if nothing hit it. We assert via `cy.get(alias)`:
// it resolves to the most-recent interception or `null` if none happened.
Cypress.Commands.add("expectNoRequest", (alias: string) => {
  const name = alias.startsWith("@") ? alias : `@${alias}`;
  return cy.get(name).should((interception: any) => {
    // When the alias has never been matched, cy.get returns null.
    // When it has, it returns the most recent Interception object. We want
    // the former.
    expect(interception, `expected no requests for ${name}`).to.be.null;
  });
});

export {};
