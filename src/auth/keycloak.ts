import Keycloak from "keycloak-js";

const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
};

const keycloak = new Keycloak(keycloakConfig);

// ─────────────────────────────────────────────────────────────────────────────
// Cypress test-only escape hatch.
//
// If a Cypress spec sets `window.__CYPRESS_KEYCLOAK_STUB__` BEFORE the app
// bundle loads (via `cy.visit(..., { onBeforeLoad })`), we replace the real
// Keycloak singleton's init/updateToken/login/logout with no-op stubs and
// seed `authenticated`, `token`, `tokenParsed`, `realm`, `authServerUrl`
// from the fixture. This lets every spec run without contacting a real SSO
// server. It is also defensively a no-op in SSR/Node contexts (no `window`).
//
// In production this branch is never entered — the global is never set —
// so this has zero runtime cost beyond a single `typeof window` check at
// module load. Do not extend this with logic that affects production paths.
// ─────────────────────────────────────────────────────────────────────────────
if (
  typeof window !== "undefined" &&
  (window as any).__CYPRESS_KEYCLOAK_STUB__ !== undefined
) {
  type CypressKeycloakStub = {
    authenticated: boolean;
    token?: string;
    tokenParsed?: Record<string, any>;
    realm?: string;
    authServerUrl?: string;
    initRejects?: boolean;
    initDelayMs?: number;
  };

  const stub: CypressKeycloakStub = (window as any).__CYPRESS_KEYCLOAK_STUB__;
  const kc = keycloak as any;

  // Seed the fixture-defined state onto the singleton.
  kc.authenticated = stub.authenticated;
  if (stub.token !== undefined) kc.token = stub.token;
  if (stub.tokenParsed !== undefined) kc.tokenParsed = stub.tokenParsed;
  if (stub.realm !== undefined) kc.realm = stub.realm;
  if (stub.authServerUrl !== undefined) kc.authServerUrl = stub.authServerUrl;

  // Shared call-counter the specs can read to assert behavior.
  const calls: {
    login: number;
    logout: number;
    updateToken: number;
    lastLogoutRedirectUri?: string;
  } = { login: 0, logout: 0, updateToken: 0 };
  (window as any).__cypressKeycloakCalls = calls;

  kc.init = function stubbedInit(): Promise<boolean> {
    if (stub.initRejects) {
      return Promise.reject(new Error("stubbed"));
    }
    if (typeof stub.initDelayMs === "number" && stub.initDelayMs > 0) {
      return new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(stub.authenticated), stub.initDelayMs),
      );
    }
    return Promise.resolve(stub.authenticated);
  };

  kc.updateToken = function stubbedUpdateToken(
    _minValidity?: number,
  ): Promise<boolean> {
    calls.updateToken += 1;
    return Promise.resolve(true);
  };

  kc.login = function stubbedLogin(): Promise<void> {
    calls.login += 1;
    return Promise.resolve();
  };

  kc.logout = function stubbedLogout(opts?: {
    redirectUri?: string;
  }): Promise<void> {
    calls.logout += 1;
    if (opts && typeof opts.redirectUri === "string") {
      calls.lastLogoutRedirectUri = opts.redirectUri;
    }
    return Promise.resolve();
  };
}

export default keycloak;
export { keycloakConfig };
