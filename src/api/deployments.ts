import { apiFetch } from "./http";
import keycloak from "../auth/keycloak";

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
  // Lifecycle (B6). Both nullable for legacy rows from before the
  // expires_at migration. UI: see src/utils/deployment.ts.
  expires_at?: string | null;
  expiry_warning_at?: string | null;
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
    // Nova flavor name the Heat-Stack was created with. Nullable for legacy
    // rows from before the per-instance flavor migration; new instances
    // always have it. Resolve against /openstack/flavors for vCPU/RAM/disk.
    flavor?: string | null;
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
  /**
   * course_groups.id this credential belongs to. NULL = lecturer/admin
   * credential (not tied to a student group). Drives the Dozent/Gruppen
   * split in the UI.
   */
  group_id: string | null;
  /**
   * Display name of the course group (joined from course_groups.name).
   * NULL when group_id is NULL.
   */
  group_name: string | null;
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

// Allowed deployment runtimes in months. Must mirror the backend's
// ALLOWED_RUNTIME_MONTHS — wizard <Select> options must stay in sync.
export type RuntimeMonths = 1 | 3 | 4 | 6 | 12 | 24;

export type DeploymentCreateRequest = {
  name?: string;
  template_version_id: string;
  course_id: string;
  // Local DB id of the active OpenstackProject (NOT the Keystone tenant UUID).
  // Backend pins the deployment to this project so later restart/delete uses
  // the right credentials even if the user later switches their clouds.yaml.
  openstack_project_id: string;
  deployment_mode?: string;
  config_json?: string;
  parameters?: Record<string, any>;
  user_files?: Record<string, string>;  // file_name -> base64-encoded content
  // Optional — backend defaults to 4 months if omitted.
  runtime_months?: RuntimeMonths;
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

// All deployment endpoints below take `openstackProjectId` (local DB id of
// the active OpenstackProject). Lecturers MUST pass it — backend returns 400
// otherwise. Admins may pass null to skip the filter and see everything.
function projectQuery(openstackProjectId: string | null): string {
  return openstackProjectId ? `?openstack_project_id=${encodeURIComponent(openstackProjectId)}` : "";
}

export async function getDeployment(deploymentId: string, openstackProjectId: string | null) {
  return apiFetch<DeploymentResponse>(
    `/api/v1/deployments/${deploymentId}${projectQuery(openstackProjectId)}`,
  );
}

export async function getDeploymentCredentials(deploymentId: string, openstackProjectId: string | null) {
  return apiFetch<{
    success: boolean;
    message?: string;
    data: DeploymentCredentialsResponse;
    errors: unknown;
    timestamp?: string;
    request_id?: string;
  }>(`/api/v1/deployments/${deploymentId}/credentials${projectQuery(openstackProjectId)}`);
}

export async function getDeploymentLogs(deploymentId: string, openstackProjectId: string | null) {
  return apiFetch<{
    success: boolean;
    message: string;
    data: DeploymentLogDto[];
    errors: unknown;
    timestamp: string;
    request_id: string;
  }>(`/api/v1/deployments/${deploymentId}/logs${projectQuery(openstackProjectId)}`);
}

/**
 * Stream deployment logs via SSE (fetch-based, supports Bearer auth).
 * Calls onLog for each new log entry, onDone when stream closes.
 * Returns a cleanup function to abort the stream.
 */
export function streamDeploymentLogs(
  deploymentId: string,
  sinceId: string | undefined,
  openstackProjectId: string | null,
  onLog: (log: DeploymentLogDto) => void,
  onDone: () => void,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      try { await keycloak.updateToken(30); } catch {}
      const token = keycloak.token;
      // Build query string with both since_id (optional) and openstack_project_id (required for lecturers).
      const params = new URLSearchParams();
      if (sinceId) params.set("since_id", sinceId);
      if (openstackProjectId) params.set("openstack_project_id", openstackProjectId);
      const qs = params.toString();
      const url = `/api/v1/deployments/${deploymentId}/logs/stream${qs ? `?${qs}` : ""}`;

      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });

      if (!res.ok || !res.body) { onDone(); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("event: done")) { onDone(); return; }
          if (line.startsWith("data: ")) {
            try { onLog(JSON.parse(line.slice(6))); } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error("SSE error", e);
    }
    onDone();
  })();

  return () => controller.abort();
}

/**
 * Single delete/cancel endpoint.
 *
 * The backend uses ONE endpoint for both operations: it inspects the
 * current deployment status and decides itself whether to cancel an
 * in-flight build (`queued`, `creating`) or tear down a finished
 * deployment (`running`, `failed`). The frontend does not branch.
 *
 * Returns 204 No Content on success and flips the row's status to
 * `deleting` synchronously, so the caller can poll for the actual
 * teardown to finish.
 *
 * Throws an `Error & { status: number }` on non-2xx so callers can map
 * 401/403/404/500 to the right toast.
 */
export async function deleteDeployment(deploymentId: string, openstackProjectId: string | null) {
  await keycloak.updateToken(30).catch(() => {});
  const res = await fetch(
    `/api/v1/deployments/${deploymentId}${projectQuery(openstackProjectId)}`,
    {
      method: "DELETE",
      headers: keycloak.token ? { Authorization: `Bearer ${keycloak.token}` } : {},
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(text || res.statusText) as Error & { status: number; body: string };
    err.status = res.status;
    err.body = text;
    throw err;
  }
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

export async function getAllDeployments(openstackProjectId: string | null): Promise<DeploymentDto[]> {
  const resp = await apiFetch<DeploymentsListEnvelope | DeploymentDto[]>(
    `/api/v1/deployments${projectQuery(openstackProjectId)}`,
  );
  if (resp && typeof resp === "object" && "data" in resp) {
    return (resp as DeploymentsListEnvelope).data || [];
  }
  return Array.isArray(resp) ? resp : [];
}

// ── Lifecycle: extend deployment ─────────────────────────────────────────────
//
// PATCH /api/v1/deployments/{id}/extend pushes expires_at and expiry_warning_at
// into the future by `runtime_months`. Anchored on max(now, current_expires_at)
// so a user clicking "+4 months" while the deployment still has 60 days left
// stacks the extension; a user clicking after expiry but before the Beat sweep
// gets a fresh window from now.

export type DeploymentExtendResponse = {
  deployment_id: string;
  expires_at: string;
  expiry_warning_at: string;
  runtime_months_added: number;
};

export async function extendDeployment(
  deploymentId: string,
  runtimeMonths: RuntimeMonths,
  openstackProjectId: string | null,
): Promise<DeploymentExtendResponse> {
  const resp = await apiFetch<{
    success: boolean;
    message: string;
    data: DeploymentExtendResponse;
    errors: unknown;
    timestamp: string;
    request_id: string;
  }>(
    `/api/v1/deployments/${deploymentId}/extend${projectQuery(openstackProjectId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ runtime_months: runtimeMonths }),
    },
  );
  return resp.data;
}
