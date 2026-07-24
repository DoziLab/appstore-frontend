// Ambient type declarations for our custom Cypress commands.
//
// Mirrored from commands.ts. Keep these in sync when adding/removing
// commands so spec authors get IDE completion and type checking.

export {};

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

type InterceptOverride =
  | { fixture: string }
  | { body: any }
  | { statusCode: number; body?: any; fixture?: string }
  | ((req: any) => void);

type MockApiOverrides = Partial<Record<string, InterceptOverride>>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable<Subject = any> {
      /**
       * Loads the keycloak fixture for `role` and stashes the (optionally
       * overridden) stub object in `Cypress.env("keycloakStub")` for the
       * caller to install on `window.__CYPRESS_KEYCLOAK_STUB__`.
       *
       * Prefer `cy.loginAs(role, url)` for the common case — it handles the
       * visit-with-onBeforeLoad plumbing in one step.
       */
      stubKeycloak(
        role: Role,
        overrides?: Partial<CypressKeycloakStub>,
      ): Chainable<CypressKeycloakStub>;

      /**
       * Visit `url` with the keycloak fixture for `role` installed onto
       * `window.__CYPRESS_KEYCLOAK_STUB__` BEFORE the app bundle loads.
       * Patched src/auth/keycloak.ts reads that global at module load and
       * monkey-patches the Keycloak singleton's init/updateToken/login/
       * logout, plus seeds authenticated/token/tokenParsed/realm.
       */
      loginAs(
        role: Role,
        url?: string,
        options?: LoginAsOptions,
      ): Chainable<Cypress.AUTWindow>;

      /**
       * Registers the default GET intercepts for the most common API
       * endpoints. Each is aliased (`@getProjects`, `@getQuotas`,
       * `@getDeployments`, `@getTemplates`, `@getTemplateVersions`,
       * `@getCourses`, `@getKeycloakGroups`, `@getFlavors`).
       *
       * Specs can override individual endpoints AFTER calling cy.mockApi;
       * later registrations win in Cypress.
       */
      mockApi(overrides?: MockApiOverrides): Chainable<void>;

      /**
       * Asserts that no request matched the given intercept alias. Pass
       * either `"@aliasName"` or `"aliasName"`.
       */
      expectNoRequest(alias: string): Chainable<any>;
    }
  }
}
