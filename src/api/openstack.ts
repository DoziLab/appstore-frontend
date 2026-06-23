import { apiFetch } from "./http";

// Nova flavor as exposed by GET /api/v1/openstack/flavors. Mirrors the
// backend's FlavorDto 1:1 — keep field names in sync if backend renames.
export type FlavorDto = {
  id: string;
  name: string;
  vcpus: number;
  ram_mb: number;
  disk_gb: number;
  ephemeral_gb: number;
  is_public: boolean;
};

export type FlavorsResponse = {
  project_id: string;
  project_name: string;
  // Only set when an admin queries another user's project; null for lecturers.
  owner_user_id: string | null;
  // Pre-sorted by (vcpus ASC, ram_mb ASC) — no need to re-sort client-side.
  flavors: FlavorDto[];
  fetched_at: string;
};

type FlavorsEnvelope = { success?: boolean; data: FlavorsResponse } & Record<string, unknown>;

/**
 * Fetch the Nova flavors visible to a project.
 *
 * - No args → caller's own project (mirrors `getQuotas()` semantics).
 * - `projectId` → admin queries a specific OpenStack project (local DB id).
 * - `lecturerId` → admin queries the project owned by a lecturer; backend
 *   resolves to that user's project. `lecturerId` takes precedence on the
 *   backend if both are set, but we don't send both at once on purpose.
 */
export async function getFlavors(opts?: {
  projectId?: string;
  lecturerId?: string;
}): Promise<FlavorsResponse> {
  const params = new URLSearchParams();
  if (opts?.projectId) params.set("project_id", opts.projectId);
  if (opts?.lecturerId) params.set("lecturer_id", opts.lecturerId);

  const qs = params.toString();
  const path = `/api/v1/openstack/flavors${qs ? `?${qs}` : ""}`;
  const resp = await apiFetch<FlavorsResponse | FlavorsEnvelope>(path);

  // Normalize envelope → bare payload.
  if (resp && typeof resp === "object" && "data" in resp) {
    return (resp as FlavorsEnvelope).data;
  }
  return resp as FlavorsResponse;
}
