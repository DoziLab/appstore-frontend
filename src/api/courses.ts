import { apiFetch } from "./http";

export type CourseDto = {
  id: string;
  name: string;
  semester: string;
  lecturer_id: string;
  deployments: unknown[];
  created_at: string;
  updated_at: string;
};

export type CoursesResponse = {
  success: boolean;
  message: string;
  data: CourseDto[];
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

export async function getMyCourses(params?: {
  page?: number;
  page_size?: number;
  semester?: string;
  search?: string;
  lecturer_id?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.page_size) sp.set("page_size", String(params.page_size));
  if (params?.semester) sp.set("semester", params.semester);
  if (params?.search) sp.set("search", params.search);
  if (params?.lecturer_id) sp.set("lecturer_id", params.lecturer_id);

  const qs = sp.toString();
  return apiFetch<CoursesResponse>(`/api/v1/courses/my${qs ? `?${qs}` : ""}`);
}

export type CreateCourseRequest = {
  name: string;
  courseCode: string;
};

export type CreateCourseResponse = {
  success: boolean;
  message: string;
  data: CourseDto; // assuming it returns created course object
  errors: unknown;
  timestamp?: string;
  request_id?: string;
};

export async function createCourse(payload: CreateCourseRequest) {
  return apiFetch<CreateCourseResponse>("/api/v1/courses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
