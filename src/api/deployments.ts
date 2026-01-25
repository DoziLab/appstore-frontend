import { apiFetch } from "./http";

export type DeploymentDto = {
    id: string;
    name: string;
    status: string;
    created_at: string;
    updated_at: string;
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
