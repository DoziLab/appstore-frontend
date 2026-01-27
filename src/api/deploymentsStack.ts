import { apiFetch } from "./http";

export type DeploymentStackDto = {
    stack_id: string;
    stack_name: string;
    status: string; // OpenStack Status (CREATE_COMPLETE, ...)
    creation_time: string;
    updated_time: string | null;

    deployment_id: string | null;
    deployment_status: string | null;

    openstack_project_id: string;
    openstack_project_name: string;
};
export type DeploymentStacksResponse = {
    success: boolean;
    message: string;
    data: DeploymentStackDto[];
    pagination: {
        page: number;
        page_size: number;
        total_items: number;
        total_pages: number;
    };
};
export async function getDeployments(params?: {
    page?: number;
    page_size?: number;
}) {
    const sp = new URLSearchParams();

    if (params?.page) sp.set("page", String(params.page));
    if (params?.page_size) sp.set("page_size", String(params.page_size));

    return apiFetch<DeploymentStacksResponse>(
        `/api/v1/deployments${sp.toString() ? `?${sp}` : ""}`
    );
}
