import { apiFetch } from "./http";

/**
 * Admin-verwaltete Kurs-Filter ("Kurskürzel"-Chips). Der Backend speichert nur
 * die Liste der Filter-Strings; das eigentliche Filtern der Kursliste passiert
 * client-seitig (siehe Courses.tsx). Lesen ist für alle eingeloggten User offen
 * (Lecturer + Admin), Schreiben (POST/PATCH/DELETE) ist Admin-only — ein
 * Lecturer bekommt vom Backend 403.
 *
 * Contract: `/api/v1/course-filters` (staging). Antworten folgen der üblichen
 * `{success, message, data, pagination, request_id}`-Hülle wie /courses.
 */
export type CourseFilter = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type CourseFilterListResponse = {
  success: boolean;
  message: string;
  data: CourseFilter[];
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

type CourseFilterItemResponse = {
  success: boolean;
  message: string;
  data: CourseFilter;
  errors: unknown;
  timestamp: string;
  request_id: string;
};

type CourseFilterDeleteResponse = {
  success: boolean;
  message: string;
  data: null;
  errors: unknown;
  timestamp: string;
  request_id: string;
};

/**
 * List course filters, unwrapped to the bare array. The list is small and the
 * chip-bar needs all of them at once, so we request the max page_size (100 —
 * the backend cap in src/core/dependencies.py) to get everything in one shot,
 * mirroring how Courses.tsx pulls the full course set.
 */
export async function listCourseFilters(params?: {
  page?: number;
  page_size?: number;
  search?: string;
}): Promise<CourseFilter[]> {
  const sp = new URLSearchParams();
  sp.set("page", String(params?.page ?? 1));
  sp.set("page_size", String(params?.page_size ?? 100));
  if (params?.search) sp.set("search", params.search);

  const res = await apiFetch<CourseFilterListResponse>(
    `/api/v1/course-filters?${sp.toString()}`,
  );
  return res.data || [];
}

/**
 * Create a course filter (admin only). Sends `{name}` ONLY — the backend schema
 * is `extra="forbid"`, so any extra key (id/color/…) yields a 422. On a
 * duplicate name the backend answers 409 with message
 * "Course filter with name 'X' already exists". Callers should catch `ApiError`
 * and branch on `.status` (409 / 422) — see http.ts.
 */
export async function createCourseFilter(name: string): Promise<CourseFilter> {
  const res = await apiFetch<CourseFilterItemResponse>(`/api/v1/course-filters`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return res.data;
}

/** Rename a course filter (admin only). Body is `{name}` only. 404 unknown id,
 *  409 name taken, 422 empty/invalid. */
export async function updateCourseFilter(
  id: string,
  name: string,
): Promise<CourseFilter> {
  const res = await apiFetch<CourseFilterItemResponse>(
    `/api/v1/course-filters/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ name }),
    },
  );
  return res.data;
}

/** Delete a course filter (admin only). 200 with `data: null`; 404 unknown id. */
export async function deleteCourseFilter(id: string): Promise<void> {
  await apiFetch<CourseFilterDeleteResponse>(`/api/v1/course-filters/${id}`, {
    method: "DELETE",
  });
}
