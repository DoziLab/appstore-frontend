import { apiFetch } from "./http";

export type TemplateVersionDto = {
  id: string;
  template_id: string;
  version: string;
  git_commit_sha: string;
  is_active: boolean;
  created_at: string;
  parameters?: Array<{
    name: string;
    type: string;
    default?: any;
    label?: string;
    description?: string;
    required?: boolean;
    secret?: boolean;
  }>;
};

export type TemplateDto = {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
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
