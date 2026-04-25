import { apiFetch } from "./http";

export type OpenstackCredentialsCreate = {
  auth_url: string;
  username: string;
  password: string;
  user_domain_name: string;
  region_name: string;
  openstack_project_id: string;
  openstack_project_name: string;
};

export type OpenstackProjectResponse = {
  id: string;
  owner_user_id: string;
  openstack_project_id: string;
  openstack_project_name: string;
  region_name: string;
  created_at: string;
  updated_at: string;
};

export type OpenstackCredentialsResponse = OpenstackProjectResponse & {
  auth_url: string;
  username: string;
  password: string;
  user_domain_name: string;
};

type Envelope<T> = { data: T } & Record<string, unknown>;

function unwrap<T>(resp: T | Envelope<T>): T {
  if (resp && typeof resp === "object" && "data" in (resp as object)) {
    return (resp as Envelope<T>).data;
  }
  return resp as T;
}

export async function listOpenstackProjects(): Promise<OpenstackProjectResponse[]> {
  const resp = await apiFetch<OpenstackProjectResponse[] | Envelope<OpenstackProjectResponse[]>>(
    "/api/v1/openstack-projects"
  );
  return unwrap(resp);
}

export async function createOpenstackProject(
  data: OpenstackCredentialsCreate
): Promise<OpenstackCredentialsResponse> {
  const resp = await apiFetch<OpenstackCredentialsResponse | Envelope<OpenstackCredentialsResponse>>(
    "/api/v1/openstack-projects",
    { method: "POST", body: JSON.stringify(data) }
  );
  return unwrap(resp);
}

export async function deleteOpenstackProject(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/openstack-projects/${id}`, { method: "DELETE" });
}

export async function getOpenstackProject(id: string): Promise<OpenstackCredentialsResponse> {
  const resp = await apiFetch<OpenstackCredentialsResponse | Envelope<OpenstackCredentialsResponse>>(
    `/api/v1/openstack-projects/${id}`
  );
  return unwrap(resp);
}

export async function updateOpenstackProject(
  id: string,
  data: OpenstackCredentialsCreate
): Promise<OpenstackCredentialsResponse> {
  const resp = await apiFetch<OpenstackCredentialsResponse | Envelope<OpenstackCredentialsResponse>>(
    `/api/v1/openstack-projects/${id}`,
    { method: "PUT", body: JSON.stringify(data) }
  );
  return unwrap(resp);
}
