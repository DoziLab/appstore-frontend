import { apiFetch } from "./http";
import keycloak from "../auth/keycloak";

export type TemplateParameter = {
  name: string;
  type: string;
  default?: any;
  label?: string;
  description?: string;
  required?: boolean;
  secret?: boolean;
  step?: string;
  hidden?: boolean;
  enum?: string[];
  min?: number;
  max?: number;
};

export type UserFileDefinition = {
  name: string;
  label?: string;
  description?: string;
  required?: boolean;
  accept?: string;
  destination?: string;
  mode?: "all_stacks" | "per_group";
};

// Approval lebt ausschließlich auf der Version, nicht mehr auf dem Template
// (Migration a7c4f2b91d34_per_version_approval_and_github_app). Werte
// entsprechen 1:1 dem Backend-Enum `TemplateVersionApprovalStatus`.
export type TemplateVersionApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "deprecated";

export type TemplateVersionDto = {
  id: string;
  template_id: string;
  version: string;
  git_commit_sha: string;
  is_active: boolean;
  approval_status: TemplateVersionApprovalStatus;
  approved_by_id: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  parameters?: TemplateParameter[];
  user_files?: UserFileDefinition[];
  allow_user_files?: boolean;
};

export type TemplateDto = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  // Cached display fields refreshed from the Keycloak token on the owner's
  // last login. Null for service accounts or users who haven't logged in
  // since the migration that introduced them — frontend should fall back
  // through owner_name → owner_username → owner_id.
  owner_name: string | null;
  owner_email: string | null;
  owner_username: string | null;
  repo_url: string;
  icon_url: string | null;
  visibility: string;
  // Hinweis: Approval lebt nur noch pro Version. Der Backend-Endpoint
  // `GET /templates` liefert seit der Per-Version-Migration KEINEN
  // `approval_status` mehr auf Template-Ebene. Wenn Code früher
  // `template.approval_status === 'approved'` lesen wollte, war das nach
  // der Migration immer `undefined` — also stillschweigend falsch.
  // Den UI-Status fürs Template leitet man jetzt aus `versions[]` ab
  // (siehe `lib/template-status.ts`).
  versions?: TemplateVersionDto[];
  created_at: string;
  updated_at: string;
};

export type TemplatesResponse = {
  success: boolean;
  message: string;
  data: TemplateDto[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
  errors: unknown;
  timestamp: string;
  request_id: string;
};

export async function getTemplates(params?: {
  page?: number;
  page_size?: number;
  status?: string;
  visibility?: string;
  owner_id?: string;
  search?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.page_size) sp.set("page_size", String(params.page_size));
  if (params?.status) sp.set("status", params.status);
  if (params?.visibility) sp.set("visibility", params.visibility);
  if (params?.owner_id) sp.set("owner_id", params.owner_id);
  if (params?.search) sp.set("search", params.search);

  const qs = sp.toString();
  return apiFetch<TemplatesResponse>(`/api/v1/templates${qs ? `?${qs}` : ""}`);
}

export async function getTemplate(templateId: string) {
  return apiFetch<{
    success: boolean;
    message: string;
    data: TemplateDto;
    errors: unknown;
    timestamp: string;
    request_id: string;
  }>(`/api/v1/templates/${templateId}`);
}

export async function getTemplateVersion(versionId: string, includeParameters = true) {
  const sp = new URLSearchParams();
  sp.set("include_parameters", String(includeParameters));
  return apiFetch<{
    success: boolean;
    message: string;
    data: TemplateVersionDto;
    errors: unknown;
    timestamp: string;
    request_id: string;
  }>(`/api/v1/template-versions/${versionId}?${sp.toString()}`);
}

export async function getTemplateVersions(templateId: string, activeOnly = false) {
  const sp = new URLSearchParams();
  if (activeOnly) sp.set("active_only", "true");
  return apiFetch<{
    success: boolean;
    message: string;
    data: TemplateVersionDto[];
    errors: unknown;
    timestamp: string;
    request_id: string;
  }>(`/api/v1/template-versions/template/${templateId}${sp.toString() ? `?${sp.toString()}` : ""}`);
}

/**
 * Aktiviert eine bestimmte Template-Version. Das Backend deaktiviert
 * automatisch alle anderen Versionen desselben Templates — d.h. das ist die
 * Operation hinter „Template auf neue Version aktualisieren". Erlaubt für
 * Template-Owner und Admins; das Approval-Flag der Version ist hier egal
 * (Backend prüft Approval erst beim Deploy).
 */
export async function activateTemplateVersion(versionId: string) {
  return apiFetch<{
    success: boolean;
    message: string;
    data: TemplateVersionDto;
  }>(`/api/v1/template-versions/${versionId}/activate`, { method: "POST" });
}

/**
 * Partial update auf ein Template. Backend erlaubt das für Owner-or-Admin
 * (`templates.py:138` → `template_service.update_template`). Seit Commit
 * `2641a01` ("approval flow applies only to public templates") dürfen
 * Owner UND Admins `visibility` umschalten — der frühere Admin-only-Riegel
 * ist entfallen. Der Visibility-Wechsel hat einen Seiteneffekt: private →
 * public setzt alle Versionen ohne Status auf PENDING; public → private
 * räumt approval_status/approved_by/_at/reason auf NULL.
 */
export type TemplateUpdatePayload = {
  name?: string;
  description?: string | null;
  repo_url?: string;
  icon_url?: string | null;
  visibility?: "public" | "private";
};

export async function updateTemplate(
  templateId: string,
  patch: TemplateUpdatePayload,
) {
  return apiFetch<{
    success: boolean;
    message: string;
    data: TemplateDto;
  }>(`/api/v1/templates/${templateId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

/**
 * Löscht ein Template komplett (inkl. aller Versionen und Files — das Backend
 * macht das via Cascade in `template_repo.delete`). Owner-or-Admin. Backend
 * antwortet mit 204 No Content; deshalb gehen wir hier am gemeinsamen
 * `apiFetch` vorbei (das ruft unbedingt `res.json()` und würde am leeren
 * Body scheitern — siehe `deleteDeployment` für die gleiche Konstruktion).
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  await keycloak.updateToken(30).catch(() => {});
  const res = await fetch(`/api/v1/templates/${templateId}`, {
    method: "DELETE",
    headers: keycloak.token ? { Authorization: `Bearer ${keycloak.token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text || res.statusText;
    try {
      const json = JSON.parse(text);
      if (json?.message) message = json.message;
      else if (json?.detail) message = json.detail;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }
}

/**
 * Löscht eine einzelne Template-Version. Owner-or-Admin. Backend blockiert
 * das Löschen der einzigen aktiven Version mit 400 — vor diesem Aufruf also
 * besser eine andere Version aktivieren (oder im UI als disabled rendern).
 * Siehe `template_version_service.delete_version`. Backend liefert 204.
 */
export async function deleteTemplateVersion(versionId: string): Promise<void> {
  await keycloak.updateToken(30).catch(() => {});
  const res = await fetch(`/api/v1/template-versions/${versionId}`, {
    method: "DELETE",
    headers: keycloak.token ? { Authorization: `Bearer ${keycloak.token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text || res.statusText;
    try {
      const json = JSON.parse(text);
      if (json?.message) message = json.message;
      else if (json?.detail) message = json.detail;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }
}

// Approval lebt seit der Per-Version-Migration ausschließlich auf
// `TemplateVersion`. Die zugehörigen Helfer sind in `api/github.ts`:
// `approveTemplateVersion` / `rejectTemplateVersion`.
