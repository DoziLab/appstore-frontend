# Cypress integration tests

End-to-end tests for the appstore-frontend. The dev server (Vite, port 3000)
runs as normal, but every backend call is intercepted with fixture JSON and
Keycloak is fully stubbed — no real backend or SSO server is contacted.

## Running

```bash
# headless (assumes dev server already up on http://127.0.0.1:3000)
npm run test:e2e

# interactive launcher
npm run test:e2e:open

# CI helper: boots Vite, waits for it, then runs the specs
npm run test:ci
```

## Keycloak stub design

`src/auth/keycloak.ts` ships with a no-op guard that activates only when
`window.__CYPRESS_KEYCLOAK_STUB__` is defined at module-evaluation time.
When the guard fires, it:

- copies fixture props (`authenticated`, `token`, `tokenParsed`, `realm`,
  `authServerUrl`) onto the singleton, and
- replaces `init`, `updateToken`, `login`, `logout` with stubs that resolve
  to fixture-defined values and record call counts on
  `window.__cypressKeycloakCalls`.

`cy.loginAs(role, url)` installs the stub via `cy.visit`'s `onBeforeLoad`
hook, so the global is in place before the app bundle evaluates. The hook
costs nothing in production (the global is never set there).

Fixture stub shape:

```ts
type CypressKeycloakStub = {
  authenticated: boolean;
  token?: string;
  tokenParsed?: Record<string, any>;
  realm?: string;
  authServerUrl?: string;
  initRejects?: boolean;  // init() rejects (error banner)
  initDelayMs?: number;   // init() resolves after delay (loading state)
};
```

## Custom commands

All declared in `cypress/support/commands.ts` with ambient types in
`cypress/support/index.d.ts`.

- `cy.loginAs(role, url?, options?)` — visit with a keycloak stub installed.
  Roles: `"lecturer" | "admin" | "unauthenticated" | "expiring" | "init-error"`.
  Use `options.stubOverrides` to flip individual stub fields per-spec.
- `cy.stubKeycloak(role, overrides?)` — load+merge a keycloak fixture and
  stash it in `Cypress.env("keycloakStub")` without visiting. Rarely needed;
  prefer `cy.loginAs`.
- `cy.mockApi(overrides?)` — register the default GET intercepts. Each is
  aliased: `@getProjects`, `@getQuotas`, `@getDeployments`, `@getTemplates`,
  `@getTemplateVersions`, `@getCourses`, `@getKeycloakGroups`, `@getFlavors`.
  Per-spec overrides can be passed in or just `cy.intercept(...)`-ed after
  this call — later intercepts win.
- `cy.expectNoRequest(alias)` — asserts an intercept alias was never matched.

## Fixture layout

```
cypress/fixtures/
  keycloak/                     # role-shaped Keycloak stub objects
    lecturer.json
    admin.json
    unauthenticated.json
    expiring.json
    init-error.json
  openstack-projects/
    single.json                 # one project for the active user
    empty.json
  quotas/default.json
  deployments/empty.json
  templates/approved-list.json
  template-versions/queue-empty.json
  courses/list.json
  keycloak-groups/list.json
  flavors/list.json
  errors/
    404.json
    409-with-id.json
    500.json
```

All fixtures mirror the runtime types in `src/api/*.ts`. When adding a new
fixture, look at the corresponding `.ts` file first and only include fields
the frontend actually reads.

## Test independence and selectors

- Specs are independent — never rely on test ordering. Each test calls
  `cy.loginAs(...)` and `cy.mockApi(...)` itself.
- No fixed waits (`cy.wait(ms)`). Use intercept aliases (`cy.wait("@getX")`)
  or assertion retry.
- Selectors: prefer ARIA roles + accessible names (`cy.findByRole("button",
  {name: /deploy/i})`), then text (`cy.contains(...)`). Use CSS class
  selectors only as a last resort.

### data-testid policy

`data-testid` may be added to production code **only** when there is no
robust role/text selector — and only by the spec author who needs it, with
a justification in the diff. The initial scaffold adds no testids.
