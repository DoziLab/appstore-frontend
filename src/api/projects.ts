import { apiFetch } from "./http";

/* =========================
   DTOs
========================= */

export type ProjectQuotaDto = {
    instances: {
        used: number;
        limit: number;
    };
    vcpus: {
        used: number;
        limit: number;
    };
    ram_gb: {
        used: number;
        limit: number;
    };
    storage_gb: {
        used: number;
        limit: number;
    };
};

export type OpenStackProjectDto = {
    id: string;                    // interne ID
    openstack_project_id: string;  // OS Project ID
    openstack_project_name: string;

    owner_user_id: string;
    owner_name: string;
    owner_email: string;

    quotas: ProjectQuotaDto;

    last_activity_at?: string;
    created_at: string;
    updated_at: string;
};

/* =========================
   Responses
========================= */

export type OpenStackProjectsResponse = {
    success: boolean;
    message?: string;
    data: OpenStackProjectDto[];
    pagination?: {
        page: number;
        page_size: number;
        total_items: number;
        total_pages: number;
    };
    errors?: unknown;
    timestamp?: string;
    request_id?: string;
};

export type OpenStackProjectResponse = {
    success: boolean;
    message?: string;
    data: OpenStackProjectDto;
    errors?: unknown;
    timestamp?: string;
    request_id?: string;
};

/* =========================
   API Calls
========================= */

export async function getOpenStackProjects(params?: {
    page?: number;
    page_size?: number;
    owner_user_id?: string;
}) {
    const sp = new URLSearchParams();

    if (params?.page) sp.set("page", String(params.page));
    if (params?.page_size) sp.set("page_size", String(params.page_size));
    if (params?.owner_user_id)
        sp.set("owner_user_id", params.owner_user_id);

    const qs = sp.toString();

    return apiFetch<OpenStackProjectsResponse>(
        `/api/v1/openstack-projects${qs ? `?${qs}` : ""}`
    );
}

export async function getOpenStackProject(projectId: string) {
    return apiFetch<OpenStackProjectResponse>(
        `/api/v1/openstack-projects/${projectId}`
    );
}
