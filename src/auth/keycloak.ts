import Keycloak from "keycloak-js";

const keycloakConfig = {
  url: "http://141.72.176.136:8080/",
  realm: "Dozilab",
  clientId: "appstore-frontend",
};

const keycloak = new Keycloak(keycloakConfig);

export default keycloak;
export { keycloakConfig };
