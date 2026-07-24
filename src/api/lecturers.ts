// Admin-only endpoints für die Lecturer-Verwaltung. Backend-Routen:
// GET  /api/v1/lecturers               — paginierte Liste (nur User mit
//                                        Templates ODER OpenStack-Projekten)
// GET  /api/v1/lecturers/{user_id}     — Detail mit vollständigen Ressourcen
// DEL  /api/v1/lecturers/{user_id}     — 202 Accepted; Cascade-Delete läuft
//                                        asynchron via Celery, das UI muss
//                                        die Detail-View pollen um Erfolg zu
//                                        detektieren (User verschwindet aus
//                                        der Liste bzw. 404 auf Detail).
//
// Alle Endpoints prüfen die admin-Rolle serverseitig. Ein Non-Admin bekommt
// 403 — das UI gate’t die Route zusätzlich via <ProtectedRoute requireAdmin>.

import { apiFetch } from "./http";

export type LecturerListItem = {
  id: string;
  external_id: string;
  display_name: string | null;
  email: string | null;
  username: string | null;
  last_login_at: string | null;
  template_count: number;
  deployment_count: number;
  openstack_project_count: number;
};

export type LecturerTemplateSummary = {
  id: string;
  name: string;
  visibility: string;
  version_count: number;
};

export type LecturerDeploymentSummary = {
  id: string;
  name: string;
  status: string;
  course_id: string | null;
  expires_at: string | null;
  created_at: string;
};

export type LecturerOpenstackProjectSummary = {
  id: string;
  openstack_project_name: string;
  region_name: string;
};

export type LecturerDetail = LecturerListItem & {
  templates: LecturerTemplateSummary[];
  deployments: LecturerDeploymentSummary[];
  openstack_projects: LecturerOpenstackProjectSummary[];
};

export type LecturersResponse = {
  success: boolean;
  message: string;
  data: LecturerListItem[];
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

export type LecturerDetailResponse = {
  success: boolean;
  message: string;
  data: LecturerDetail;
  errors: unknown;
  timestamp: string;
  request_id: string;
};

export type LecturerDeleteResponse = {
  success: boolean;
  message: string;
  data: {
    task_id: string;
    user_id: string;
    deployment_count: number;
    template_count: number;
  };
  errors: unknown;
  timestamp: string;
  request_id: string;
};

export async function listLecturers(params?: {
  skip?: number;
  limit?: number;
  search?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.skip !== undefined) sp.set("skip", String(params.skip));
  if (params?.limit !== undefined) sp.set("limit", String(params.limit));
  if (params?.search) sp.set("search", params.search);
  const qs = sp.toString();
  return apiFetch<LecturersResponse>(
    `/api/v1/lecturers${qs ? `?${qs}` : ""}`,
  );
}

export async function getLecturer(userId: string) {
  return apiFetch<LecturerDetailResponse>(`/api/v1/lecturers/${userId}`);
}

/**
 * Startet den asynchronen Cascade-Delete eines Lecturer-Accounts. Backend
 * antwortet direkt mit 202 Accepted und einer Celery-Task-ID. Die
 * tatsächliche Löschung (Deployments mit Heat-Cleanup, Templates,
 * OSP-Zeilen, User-Zeile) läuft im Hintergrund — Erfolg detektiert das UI
 * per Polling der Detail-View (404 = weg).
 */
export async function deleteLecturer(userId: string) {
  return apiFetch<LecturerDeleteResponse>(
    `/api/v1/lecturers/${userId}`,
    { method: "DELETE" },
  );
}
