import keycloak from '../auth/keycloak';

// Keycloak Configuration - sollte aus .env kommen
const KEYCLOAK_URL = (import.meta as any).env?.VITE_KEYCLOAK_URL || keycloak.authServerUrl || 'http://localhost:8080';
const REALM_NAME = (import.meta as any).env?.VITE_KEYCLOAK_REALM || keycloak.realm || 'dozilab';

async function getAccessToken(): Promise<string | undefined> {
  if (!keycloak?.authenticated) return undefined;
  try {
    await keycloak.updateToken(30);
  } catch {
    // Token refresh failed
  }
  return keycloak.token;
}

async function keycloakFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  
  const res = await fetch(`${KEYCLOAK_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Keycloak API ${res.status}: ${text || res.statusText}`);
  }

  // Some Keycloak endpoints return 204 No Content
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return {} as T;
  }

  return res.json() as Promise<T>;
}

export interface KeycloakGroup {
  id: string;
  name: string;
  path: string;
  subGroups?: KeycloakGroup[];
  attributes?: Record<string, string[]>;
}

export interface KeycloakUser {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled: boolean;
  emailVerified: boolean;
  attributes?: Record<string, string[]>;
}

/**
 * Lade alle Gruppen aus Keycloak (als Kurse)
 */
export const getKeycloakGroups = async (): Promise<{ data: KeycloakGroup[] }> => {
  const data = await keycloakFetch<KeycloakGroup[]>(
    `/admin/realms/${REALM_NAME}/groups`
  );
  return { data };
};

/**
 * Lade eine spezifische Gruppe
 */
export const getKeycloakGroup = async (groupId: string): Promise<{ data: KeycloakGroup }> => {
  const data = await keycloakFetch<KeycloakGroup>(
    `/admin/realms/${REALM_NAME}/groups/${groupId}`
  );
  return { data };
};

/**
 * Lade alle Mitglieder einer Gruppe (Studenten im Kurs)
 */
export const getKeycloakGroupMembers = async (
  groupId: string,
  params?: {
    first?: number;
    max?: number;
    briefRepresentation?: boolean;
  }
): Promise<{ data: KeycloakUser[] }> => {
  const queryParams = new URLSearchParams();
  if (params?.first !== undefined) queryParams.append('first', params.first.toString());
  if (params?.max !== undefined) queryParams.append('max', params.max.toString());
  if (params?.briefRepresentation !== undefined) {
    queryParams.append('briefRepresentation', params.briefRepresentation.toString());
  }

  const data = await keycloakFetch<KeycloakUser[]>(
    `/admin/realms/${REALM_NAME}/groups/${groupId}/members?${queryParams.toString()}`
  );
  return { data };
};