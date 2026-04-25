import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Polyfill crypto.randomUUID for insecure contexts (plain HTTP on non-localhost).
// keycloak-js v26+ requires crypto.randomUUID() which is only available in secure
// contexts. crypto.getRandomValues() works everywhere and is sufficient for UUIDs.
if (typeof crypto !== "undefined" && typeof crypto.randomUUID !== "function") {
  crypto.randomUUID = function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version (4) and variant (RFC 4122) bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` as `${string}-${string}-${string}-${string}-${string}`;
  };
}

import { ReactKeycloakProvider } from "@react-keycloak/web";
import { BrowserRouter } from "react-router-dom";
import keycloak from "./auth/keycloak";

const onKeycloakEvent = (event: unknown, error?: unknown) => {
  console.log("[Keycloak] event:", event, error);
};

const onKeycloakTokens = (_tokens: unknown) => {
  console.log("[Keycloak] tokens received");
};

createRoot(document.getElementById("root")!).render(
  // StrictMode removed: ReactKeycloakProvider does not support double-mount
  // (keycloak.init() can only be called once). Re-enable once migrated off
  // @react-keycloak/web.
  <ReactKeycloakProvider
    authClient={keycloak}
    initOptions={{
      onLoad: "check-sso",
      checkLoginIframe: false,
      enableLogging: true,
      // No pkceMethod: "S256" — requires crypto.subtle which needs HTTPS.
      // Falls back to standard Authorization Code flow over plain HTTP.
    }}
    onEvent={onKeycloakEvent}
    onTokens={onKeycloakTokens}
  >
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </ReactKeycloakProvider>
);