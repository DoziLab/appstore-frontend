// GitHub-Integration: Anbindung an die Backend-Endpunkte unter
// /api/v1/auth/github/* und die Template-Import-Endpunkte.
// Die Antworten kommen im Standard-Envelope { success, message, data, ... }
// — wir packen sie hier einmal aus, damit die UI-Schicht damit nicht
// hantieren muss.

import keycloak from "../auth/keycloak";
import { apiFetch } from "./http";
import type { TemplateDto, TemplateVersionDto, TemplateParameter } from "./templates";

type Envelope<T> = {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown;
  timestamp?: string;
  request_id?: string;
};

// ---------------------------------------------------------------------------
// GitHub-App / Installation
// ---------------------------------------------------------------------------

export type GithubRepo = {
  owner: string;
  name: string;
  full_name: string;
  private: boolean;
};

export type GithubInstallationStatus = {
  connected: boolean;
  installation_id: number | null;
  repos: GithubRepo[];
};

/**
 * Erzeugt eine signierte Install-URL und liefert sie zurück. Die SPA muss
 * danach den Browser per `window.location.href = install_url` dorthin lenken
 * — ein fetch() funktioniert nicht, GitHub erwartet eine Top-Level-Navigation.
 */
export async function startGithubInstall(): Promise<{ install_url: string }> {
  const resp = await apiFetch<Envelope<{ install_url: string }>>(
    "/api/v1/auth/github/install",
    { method: "POST" },
  );
  return resp.data;
}

export async function getGithubInstallationStatus(): Promise<GithubInstallationStatus> {
  const resp = await apiFetch<Envelope<GithubInstallationStatus>>(
    "/api/v1/auth/github/installation-status",
  );
  return resp.data;
}

/**
 * Disconnect: Backend antwortet mit 204 No Content — apiFetch würde auf
 * `res.json()` knallen, deshalb nutzen wir hier wie an anderen Stellen
 * im Projekt einen direkten fetch().
 */
export async function disconnectGithubInstallation(): Promise<void> {
  await keycloak.updateToken(30).catch(() => {
    /* refresh best-effort */
  });
  const res = await fetch("/api/v1/auth/github/installation", {
    method: "DELETE",
    headers: keycloak.token ? { Authorization: `Bearer ${keycloak.token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || res.statusText);
  }
}

// ---------------------------------------------------------------------------
// Template-Import aus GitHub
// ---------------------------------------------------------------------------

export type ImportNewTemplateBody = {
  name: string;
  description?: string | null;
  icon_url?: string | null;
  github_url: string;
  app_yaml_path?: string | null;
  /**
   * Sichtbarkeit des neu angelegten Templates. Default im Backend ist
   * `"private"`. Bei `"private"` läuft kein Approval-Flow — die erste
   * Version hat `approval_status = null` und ist sofort für den Owner
   * nutzbar. Bei `"public"` greift der bestehende Pending-Flow (für
   * Lecturer) bzw. direkte Approval (für Admins).
   */
  visibility?: "private" | "public";
};

export type ImportNewVersionBody = {
  github_url: string;
  app_yaml_path?: string | null;
  is_active?: boolean;
};

export async function importTemplateFromGithub(
  body: ImportNewTemplateBody,
): Promise<TemplateDto> {
  const resp = await apiFetch<Envelope<TemplateDto>>(
    "/api/v1/templates/import-from-github",
    { method: "POST", body: JSON.stringify(body) },
  );
  return resp.data;
}

export async function importTemplateVersionFromGithub(
  templateId: string,
  body: ImportNewVersionBody,
): Promise<TemplateVersionDto> {
  const resp = await apiFetch<Envelope<TemplateVersionDto>>(
    `/api/v1/templates/${templateId}/import-from-github`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return resp.data;
}

// ---------------------------------------------------------------------------
// Approval-Queue (Template-Versionen)
// ---------------------------------------------------------------------------

import type { TemplateVersionApprovalStatus } from "./templates";

// Re-Export, damit existierende Imports `ApprovalStatus` aus `api/github`
// nicht alle umgezogen werden müssen. Quelle der Wahrheit ist `api/templates`.
export type ApprovalStatus = TemplateVersionApprovalStatus;

export type QueueSort =
  | "created_at_desc"
  | "created_at_asc"
  | "template_name_asc"
  | "template_name_desc";

export type TemplateVersionQueueItem = {
  id: string;
  template_id: string;
  version: string;
  git_commit_sha: string;
  is_active: boolean;
  approval_status: ApprovalStatus;
  approved_by_id: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  parameters?: TemplateParameter[];
  template: {
    id: string;
    name: string;
    owner_id: string;
    visibility: "private" | "public";
  };
};

export type QueuePagination = {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
};

export type QueueResponse = {
  data: TemplateVersionQueueItem[];
  pagination: QueuePagination;
  message: string;
};

export async function getTemplateVersionsQueue(params?: {
  status?: ApprovalStatus;
  template_id?: string;
  visibility?: "private" | "public";
  sort?: QueueSort;
  page?: number;
  page_size?: number;
}): Promise<QueueResponse> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.template_id) sp.set("template_id", params.template_id);
  if (params?.visibility) sp.set("visibility", params.visibility);
  if (params?.sort) sp.set("sort", params.sort);
  if (params?.page) sp.set("page", String(params.page));
  if (params?.page_size) sp.set("page_size", String(params.page_size));

  const qs = sp.toString();
  return apiFetch<QueueResponse>(
    `/api/v1/template-versions/queue${qs ? `?${qs}` : ""}`,
  );
}

export async function approveTemplateVersion(versionId: string): Promise<void> {
  await apiFetch<Envelope<unknown>>(
    `/api/v1/template-versions/${versionId}/approve`,
    { method: "POST" },
  );
}

export async function rejectTemplateVersion(
  versionId: string,
  reason?: string,
): Promise<void> {
  await apiFetch<Envelope<unknown>>(
    `/api/v1/template-versions/${versionId}/reject`,
    {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    },
  );
}

// ---------------------------------------------------------------------------
// Hilfen für die UI
// ---------------------------------------------------------------------------

/**
 * Übersetzt einen `reason`-Code vom GitHub-Install-Callback in eine deutsche
 * Nachricht für die Toast-Anzeige. Codes stammen direkt aus dem Backend.
 */
export function githubErrorMessage(reason: string | null | undefined): string {
  switch (reason) {
    case "invalid_state":
      return "GitHub-Install-Link ist abgelaufen. Bitte erneut verbinden.";
    case "request_pending":
      return "Ihr GitHub-Org-Admin muss die Installation freigeben, bevor sie abgeschlossen werden kann.";
    case "missing_installation_id":
      return "Die GitHub-Installation wurde nicht abgeschlossen.";
    case "persist_failed":
      return "Die GitHub-Verbindung konnte nicht gespeichert werden. Bitte erneut versuchen.";
    default:
      return "GitHub-Verbindung fehlgeschlagen.";
  }
}
