import { apiFetch } from "./http";

/**
 * Fachliches Deployment (DoziLab)
 * Existiert nur, wenn deployment_id !== null
 */
export type DeploymentDto = {
    id: string;                 // deployment_id
    name: string;               // abgeleitet (z.B. stack_name)
    status: DeploymentState;    // running | stopped | error | unknown
    created_at: string;
};

/**
 * Deployment-Status wie er im System wirklich existiert
 */
export type DeploymentState =
    | "running"
    | "stopped"
    | "error"
    | "unknown";

/**
 * Logs gehören IMMER zu einem Deployment
 */
export type DeploymentLogDto = {
    id: string;
    timestamp: string;
    level?: "INFO" | "WARN" | "ERROR";
    message: string;
};

export type DeploymentLogsResponse = {
    success: boolean;
    message?: string;
    data: DeploymentLogDto[];
    errors?: unknown;
    timestamp?: string;
    request_id?: string;
};

/**
 * Logs für ein konkretes Deployment
 */
export async function getDeploymentLogs(deploymentId: string) {
    return apiFetch<DeploymentLogsResponse>(
        `/api/v1/deployments/${deploymentId}/logs`
    );
}
