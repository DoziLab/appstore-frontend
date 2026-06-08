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
    access_urls: Array<{
      id: string;
      access_type: string | null;
      connection_url: string | null;
      username: string | null;
      port: number | null;
      is_active: boolean;
    }>;
    created_at: string;
    updated_at: string;
  }>;
};

export type AccessType =
  | "ssh"
  | "web_url"
  | "guacamole"
  | "rdp"
  | "vnc"
  | "database";

export type CredentialAccess = {
  access_type: AccessType;
  username: string | null;
  password: string | null;
  connection_url: string | null;
  port: number | null;
};

export type CredentialInstance = {
  instance_id: string;
  vm_name: string;
  openstack_stack_id: string;
  accesses: CredentialAccess[];
};

export type DeploymentCredentialsResponse = {
  deployment_id: string;
  instances: CredentialInstance[];
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
  course_id: string;  // Keycloak Group ID
  deployment_mode?: string;
  config_json?: string;
  heat_parameters?: Record<string, any>;
  stack_assignments?: Array<{
    groups: Array<{
      group_name: string;
      group_index: number;
      students: Array<{
        id: string;
        username: string;
        email: string;
        first_name: string;
        last_name: string;
      }>;
    }>;
  }>;
  teacher?: {
    id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
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

export async function getDeploymentCredentials(deploymentId: string) {
  return apiFetch<{
    success: boolean;
    message?: string;
    data: DeploymentCredentialsResponse;
    errors: unknown;
    timestamp?: string;
    request_id?: string;
  }>(`/api/v1/deployments/${deploymentId}/credentials`);
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

export async function deleteDeployment(deploymentId: string) {
  return apiFetch<{
    success: boolean;
    message: string;
    data?: any;
    errors: unknown;
    timestamp: string;
    request_id: string;
  }>(`/api/v1/deployments/${deploymentId}` , { method: "DELETE" });
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
