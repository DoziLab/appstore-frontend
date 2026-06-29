import { apiFetch } from "./http";

export type CourseDeploymentSummary = {
  id: string;
  name: string;
  template_version_id: string;
  deployment_mode: string;
  status: string;
  created_at: string;
};

export type CourseDto = {
  id: string;
  name: string;
  keycloak_course_id: string;
  deployments: CourseDeploymentSummary[];
  created_at: string;
  updated_at: string;
};

export type CourseGroupDto = {
  id: string;
  course_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type CourseMemberDto = {
  id: string;
  user_id: string;
  course_id: string;
  joined_at: string;
  left_at: string | null;
};

export type GroupMemberDto = {
  id: string;
  group_id: string;
  course_member_id: string;
  user_id: string;
  joined_at: string;
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
  search?: string;
  lecturer_id?: string;
  // Active OpenStack project (local DB id). The backend requires this for
  // non-admin callers; without it embedded `course.deployments` would leak
  // across owners again. Pass `null` to omit (admin context only).
  openstack_project_id?: string | null;
}) {
  const sp = new URLSearchParams();
  if (params?.page) sp.set("page", String(params.page));
  if (params?.page_size) sp.set("page_size", String(params.page_size));
  if (params?.search) sp.set("search", params.search);
  if (params?.lecturer_id) sp.set("lecturer_id", params.lecturer_id);
  if (params?.openstack_project_id) sp.set("openstack_project_id", params.openstack_project_id);

  const qs = sp.toString();
  return apiFetch<CoursesResponse>(`/api/v1/courses${qs ? `?${qs}` : ""}`);
}

export async function getCourseGroups(courseId: string) {
  return apiFetch<{
    success: boolean;
    message: string;
    data: CourseGroupDto[];
    errors: unknown;
    timestamp: string;
    request_id: string;
  }>(`/api/v1/courses/${courseId}/groups`);
}

export async function createCourseGroup(courseId: string, name: string) {
  return apiFetch<{
    success: boolean;
    message: string;
    data: CourseGroupDto;
    errors: unknown;
    timestamp: string;
    request_id: string;
  }>(`/api/v1/courses/${courseId}/groups`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function getCourseMembers(courseId: string) {
  return apiFetch<{
    success: boolean;
    message: string;
    data: CourseMemberDto[];
    errors: unknown;
    timestamp: string;
    request_id: string;
  }>(`/api/v1/courses/${courseId}/members`);
}

export async function getGroupMembers(courseId: string, groupId: string) {
  return apiFetch<{
    success: boolean;
    message: string;
    data: GroupMemberDto[];
    errors: unknown;
    timestamp: string;
    request_id: string;
  }>(`/api/v1/courses/${courseId}/groups/${groupId}/members`);
}

export async function addGroupMembers(courseId: string, groupId: string, memberIds: string[]) {
  return apiFetch<{
    success: boolean;
    message: string;
    data: GroupMemberDto[];
    errors: unknown;
    timestamp: string;
    request_id: string;
  }>(`/api/v1/courses/${courseId}/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ member_ids: memberIds }),
  });
}

/**
 * Move a single group member from its current group to a different group of
 * the same course.
 *
 * NOTE: as of staging the backend does NOT expose this endpoint yet — see
 * issue #120. We send the call anyway so the wiring is correct the moment
 * the backend lands, and surface a clear "noch nicht verfügbar" toast on the
 * 404/405 that comes back today. The endpoint shape mirrors the existing
 * `POST .../groups/{groupId}/members` route family.
 */
export async function moveGroupMember(
  courseId: string,
  fromGroupId: string,
  groupMemberId: string,
  toGroupId: string,
) {
  return apiFetch<{
    success: boolean;
    message: string;
    data: GroupMemberDto;
    errors: unknown;
    timestamp: string;
    request_id: string;
  }>(
    `/api/v1/courses/${courseId}/groups/${fromGroupId}/members/${groupMemberId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ new_group_id: toGroupId }),
    },
  );
}
