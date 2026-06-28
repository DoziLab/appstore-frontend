// Student self-service API wrapper. Spiegelt /api/v1/student/* aus dem
// Backend (siehe appstore-backend/src/api/student.py).
//
// Wichtig:
// - Diese Endpoints sind exklusiv für Realm-Role "student". Lecturer/Admin-
//   Tokens bekommen 403.
// - Kein openstack_project_id-Param — Backend filtert komplett über die
//   Course-Group-Mitgliedschaft des Users.
// - Schema der Credentials-Response ist identisch mit dem Lecturer-Endpoint
//   (`DeploymentCredentialsResponse`), nur das Set ist enger gefiltert.
import { apiFetch } from "./http";
import keycloak from "../auth/keycloak";
import type { DeploymentCredentialsResponse } from "./deployments";

// Getrimmte Sicht für Studenten — bewusst nicht DeploymentDto recyceln:
// Backend liefert deployment_parameters/course_id/lecturer-Felder gar nicht
// erst aus, und wir wollen nichts versehentlich rendern, was nicht da ist.
export type StudentDeploymentDto = {
  id: string;
  name: string;
  status: string;
  template: {
    name: string | null;
    version: string | null;
  };
  instances: Array<{
    id: string;
    vm_name: string | null;
    ip_address: string | null;
  }>;
  created_at: string | null;
  expires_at: string | null;
};

type EnvelopeArray<T> = {
  success: boolean;
  message?: string;
  data: T[];
  errors?: unknown;
  timestamp?: string;
  request_id?: string;
};

type Envelope<T> = {
  success: boolean;
  message?: string;
  data: T;
  errors?: unknown;
  timestamp?: string;
  request_id?: string;
};

export async function getStudentDeployments(): Promise<StudentDeploymentDto[]> {
  const resp = await apiFetch<EnvelopeArray<StudentDeploymentDto>>(
    `/api/v1/student/deployments`,
  );
  return resp?.data ?? [];
}

export async function getStudentDeploymentCredentials(
  deploymentId: string,
): Promise<DeploymentCredentialsResponse> {
  const resp = await apiFetch<Envelope<DeploymentCredentialsResponse>>(
    `/api/v1/student/deployments/${deploymentId}/credentials`,
  );
  return resp.data;
}

// PEM-Stream-Download. Eigene fetch()-Schleife statt apiFetch, weil:
// - Response ist kein JSON, sondern application/x-pem-file
// - Wir brauchen den Content-Disposition-Header für den Dateinamen
// - Bei 401/403/404 wollen wir den Fehler hochwerfen (analog deleteDeployment)
export async function downloadStudentSshKey(
  deploymentId: string,
  accessId: string,
  fallbackUsername?: string | null,
): Promise<void> {
  // Token vor dem Stream erneuern — das Backend liefert sonst ggf. eine
  // 0-Byte-Datei nach erstem Read, weil Auth erst beim Streamstart greift.
  await keycloak.updateToken(30).catch(() => {});
  const res = await fetch(
    `/api/v1/student/deployments/${deploymentId}/credentials/access/${accessId}/ssh-key`,
    {
      method: "GET",
      headers: keycloak.token ? { Authorization: `Bearer ${keycloak.token}` } : {},
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(text || res.statusText) as Error & {
      status: number;
      body: string;
    };
    err.status = res.status;
    err.body = text;
    throw err;
  }

  // Dateiname bevorzugt aus Content-Disposition ziehen (`attachment;
  // filename="id_ed25519_<user>"`). Fallback baut den Namen aus dem
  // Username/Access-ID — verhindert das generische "download" im Browser.
  const disposition = res.headers.get("content-disposition") || "";
  let filename = "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
  if (match?.[1]) {
    filename = decodeURIComponent(match[1]);
  }
  if (!filename) {
    const safeUser = (fallbackUsername || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
    filename = safeUser ? `id_ed25519_${safeUser}` : `id_ed25519_${accessId}`;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
