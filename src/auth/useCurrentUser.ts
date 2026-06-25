// Kleines Helferchen: zieht die für die UI relevanten Claims aus dem
// Keycloak-Token. Wir brauchen das an mehreren Stellen (AppStore-Filter,
// Owner-Detailansicht, Approve-Button-Sichtbarkeit) — daher zentralisiert.
//
// Der Keycloak-Hook erzwingt einen Re-Render, sobald sich `tokenParsed`
// ändert (Login, Refresh, Logout), daher genügt es, die Claims auf jedem
// Render frisch zu lesen.

import { useKeycloak } from "@react-keycloak/web";

export type CurrentUser = {
  userId: string | null;
  username: string | null;
  email: string | null;
  isAdmin: boolean;
  isLecturer: boolean;
  authenticated: boolean;
};

export function useCurrentUser(): CurrentUser {
  const { keycloak } = useKeycloak();
  const token = (keycloak?.tokenParsed ?? {}) as Record<string, any>;
  const roles: string[] = token?.realm_access?.roles ?? [];

  return {
    userId: token.sub ?? null,
    username: token.preferred_username ?? null,
    email: token.email ?? null,
    isAdmin: roles.includes("admin"),
    isLecturer: roles.includes("lecturer") || roles.includes("teacher"),
    authenticated: !!keycloak?.authenticated,
  };
}
