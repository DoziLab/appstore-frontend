import { apiFetch } from "./http";

export type QuotaMetric = {
	available: number;
	limit: number;
	used: number;
};

export type QuotasResponse = {
	compute: {
		cores: QuotaMetric;
		instances: QuotaMetric;
		ram: QuotaMetric; // typically in MB
	};
	network: {
		floatingip: QuotaMetric;
		network: QuotaMetric;
	};
	volume: {
		gigabytes: QuotaMetric; // in GB
		volumes: QuotaMetric;
	};
	project_id: string;
	project_name: string;
	owner_user_id: string;
	fetched_at: string;
};

type QuotasEnvelope = { success?: boolean; data: QuotasResponse } & Record<string, unknown>;

export async function getQuotas(): Promise<QuotasResponse> {
	const resp = await apiFetch<QuotasResponse | QuotasEnvelope>("/api/v1/quotas");
	// Normalize both raw and envelope responses
	if (resp && typeof resp === 'object' && 'data' in resp) {
		return (resp as QuotasEnvelope).data;
	}
	return resp as QuotasResponse;
}

