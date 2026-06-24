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

export type TemplateVersionDto = {
  id: string;
  template_id: string;
  version: string;
  git_commit_sha: string;
  is_active: boolean;
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
  approval_status: string;
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

export async function approveTemplate(templateId: string, comment?: string) {
  return apiFetch<{ success: boolean; message: string }>(
    `/api/v1/templates/${templateId}/approve`,
    { method: "POST", body: JSON.stringify({ comment: comment ?? "" }) }
  );
}

export async function rejectTemplate(templateId: string, comment?: string) {
  return apiFetch<{ success: boolean; message: string }>(
    `/api/v1/templates/${templateId}/reject`,
    { method: "POST", body: JSON.stringify({ comment: comment ?? "" }) }
  );
}
