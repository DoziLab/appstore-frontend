import { apiFetch } from "./http";

export type DeploymentStatus =
    | "ACTIVE"
    | "CREATING"
    | "FAILED"
    | "DELETING"
    | "DELETED"
    | "ERROR";

export type DeploymentDto = {
    id: string;
    name: string;
    status: DeploymentStatus;
    created_at: string;
    updated_at: string;
};

export type DeploymentLogDto = {
    id: string;
    timestamp: string;      // created_at o.ä.
    level?: string;         // INFO / ERROR (optional)
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

export type DeploymentsResponse = {
    success: boolean;
    message: string;
    data: DeploymentDto[];
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

export async function getDeployments(params?: {
    page?: number;
    page_size?: number;
}) {
    const sp = new URLSearchParams();

    if (params?.page) sp.set("page", String(params.page));
    if (params?.page_size) sp.set("page_size", String(params.page_size));

    const qs = sp.toString();

    return apiFetch<DeploymentsResponse>(
        `/api/v1/deployments${qs ? `?${qs}` : ""}`
    );
}
export async function getDeploymentLogs(deploymentId: string) {
    return apiFetch<DeploymentLogsResponse>(
        `/api/v1/deployments/${deploymentId}/logs`
    );
}

