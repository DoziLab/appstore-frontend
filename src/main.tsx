
  import { createRoot } from "react-dom/client";
  import App from "./App.tsx";
  import "./index.css";

import React from "react";
//import ReactDOM from "react-dom/client";
import { ReactKeycloakProvider } from "@react-keycloak/web";
import keycloak from "./auth/keycloak";

const onKeycloakEvent = (event: unknown, error?: unknown) => {
  // optional: Logging
  // console.log("Keycloak event", event, error);
};

const onKeycloakTokens = (tokens: unknown) => {
  // optional: Debugging
  // console.log("Keycloak tokens", tokens);
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ReactKeycloakProvider
  authClient={keycloak}
  initOptions={{
    onLoad: "check-sso",
    pkceMethod: "S256",
    checkLoginIframe: false,
  }}
  onEvent={onKeycloakEvent}
  onTokens={onKeycloakTokens}
>
  <App />
</ReactKeycloakProvider>

  </React.StrictMode>
);

  