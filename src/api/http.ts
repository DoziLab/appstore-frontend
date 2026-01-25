import keycloak from "../auth/keycloak"; // ggf. Pfad anpassen

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || "";


async function getAccessToken(): Promise<string | undefined> {
  // Falls du bereits ein Token-Refresh-Pattern hast, nutze das.
  // keycloak.updateToken(minValiditySeconds) ist üblich.
  if (!keycloak?.authenticated) return undefined;

  try {
    await keycloak.updateToken(30); // refresh wenn <30s gültig
  } catch {
    // falls refresh fehlschlägt, Token trotzdem versuchen
  }
  return keycloak.token;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }

  return res.json() as Promise<T>;
}
