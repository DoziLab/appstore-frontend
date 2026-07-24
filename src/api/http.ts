import keycloak from "../auth/keycloak"; // ggf. Pfad anpassen

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || "";

/**
 * Strukturierter Fehler aus dem Backend.
 *
 * Backend-Konvention (siehe `appstore-backend/src/core/exceptions.py`):
 * `BadRequestException` kann optional einen `code` (SCREAMING_SNAKE) und
 * `details` (frei-strukturiertes Dict) tragen. Der Exception-Handler hängt
 * beides ins JSON-Feld `errors` an, z.B.:
 *   { "success": false, "message": "Version '2.0.0' bereits vorhanden",
 *     "errors": { "code": "VERSION_ALREADY_EXISTS", "details": {…} } }
 *
 * Wir kopieren die zwei Felder hier aufs Error-Objekt, damit Callers
 * darauf branchen können ohne `.body` selbst zu re-parsen.
 */
export class ApiError extends Error {
  status: number;
  body: string;
  /** Stabiler Backend-Code, z.B. `VERSION_ALREADY_EXISTS`. `null` falls
   *  der Backend-Pfad keinen Code mitsendet (Standardfehler). */
  code: string | null;
  /** Free-form-Payload, z.B. `{ existing_version_id: "…" }`. */
  details: Record<string, unknown> | null;

  constructor(
    message: string,
    init: {
      status: number;
      body: string;
      code?: string | null;
      details?: Record<string, unknown> | null;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = init.status;
    this.body = init.body;
    this.code = init.code ?? null;
    this.details = init.details ?? null;
  }
}


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
    let message = text || res.statusText;
    let code: string | null = null;
    let details: Record<string, unknown> | null = null;
    try {
      const json = JSON.parse(text);
      if (json?.message) message = json.message;
      else if (json?.detail) message = json.detail;
      // Strukturierter Fehler-Payload aus `BadRequestException`:
      // {"errors": {"code": "...", "details": {...}}}. Defensive
      // Extraktion — alte Endpoints liefern `errors: null` oder eine
      // Validation-Array-Form, die wir hier ignorieren.
      if (json?.errors && typeof json.errors === "object" && !Array.isArray(json.errors)) {
        if (typeof json.errors.code === "string") code = json.errors.code;
        if (json.errors.details && typeof json.errors.details === "object") {
          details = json.errors.details as Record<string, unknown>;
        }
      }
    } catch {
      // not JSON, use raw text
    }
    throw new ApiError(message, {
      status: res.status,
      body: text,
      code,
      details,
    });
  }

  return res.json() as Promise<T>;
}
