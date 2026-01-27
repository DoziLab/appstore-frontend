import { apiFetch } from "./http";

export type DeploymentDto = {
  id: string;
  name: string;
  template_version_id: string;
  course_id: string;
  deployment_mode: string;
  status: string;
  openstack_stack_id?: string | null;
  config_json?: string | null;
  deployment_parameters?: string | null;
  access_types_json: string;
  created_at: string;
  updated_at: string;
  template_version?: {
    id: string;
    version: string;
    template_id: string;
    template_name?: string | null;
  } | null;
  course?: {
    id: string;
    name: string;
    lecturer_id: string;
  } | null;
  instances?: Array<{
    id: string;
    instance_name: string;
    openstack_instance_id?: string | null;
    status?: string | null;
    ip_address?: string | null;
    access_urls?: string | null;
    created_at: string;
    updated_at: string;
  }>;
};

export type DeploymentLogDto = {
  id: string;
  deployment_id: string;
  event_type: string;
  message: string;
  level: string;
  details?: Record<string, any> | null;
  request_id?: string | null;
  created_at: string;
};

export type DeploymentCreateRequest = {
  name?: string;
  template_version_id: string;
  course_id: string;
  deployment_mode: string;
  config_json?: string;
  heat_parameters?: Record<string, any>;
  group_ids?: string[];
  course_member_ids?: string[];
  access_types?: string[];
};

export type DeploymentResponse = {
  success: boolean;
  message: string;
  data: DeploymentDto;
  errors: unknown;
  timestamp: string;
  request_id: string;
};

export async function createDeployment(data: DeploymentCreateRequest) {
  return apiFetch<DeploymentResponse>("/api/v1/deployments", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getDeployment(deploymentId: string) {
  return apiFetch<DeploymentResponse>(`/api/v1/deployments/${deploymentId}`);
}

export async function getDeploymentLogs(deploymentId: string) {
  return apiFetch<{
    success: boolean;
    message: string;
    data: DeploymentLogDto[];
    errors: unknown;
    timestamp: string;
    request_id: string;
  }>(`/api/v1/deployments/${deploymentId}/logs`);
}

// List deployments (stacks) from OpenStack view
type DeploymentsListEnvelope = {
  success: boolean;
  message: string;
  data: DeploymentDto[];
  pagination?: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
  errors: unknown;
  timestamp: string;
  request_id: string;
};

export async function getAllDeployments(): Promise<DeploymentDto[]> {
  const resp = await apiFetch<DeploymentsListEnvelope | DeploymentDto[]>("/api/v1/deployments");
  if (resp && typeof resp === "object" && "data" in resp) {
    return (resp as DeploymentsListEnvelope).data || [];
  }
  return Array.isArray(resp) ? resp : [];
}
