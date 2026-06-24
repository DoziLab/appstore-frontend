import { apiFetch } from "./http";

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

// Approval lebt seit der Per-Version-Migration ausschließlich auf
// `TemplateVersion`. Die zugehörigen Helfer sind in `api/github.ts`:
// `approveTemplateVersion` / `rejectTemplateVersion`.
