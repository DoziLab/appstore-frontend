// Local group management types (not persisted in backend/keycloak)
export interface LocalStudentGroup {
  id: string; // UUID generated locally
  name: string;
  studentIds: string[]; // Keycloak user IDs
}

export interface StackAssignment {
  stackIndex: number;
  assignedStudentIds: string[]; // Keycloak user IDs
  assignedGroupIds: string[]; // Local group IDs
}

export interface DeploymentConfiguration {
  templateId: string;
  templateVersionId: string;
  deploymentName: string;
  courseId: string; // Keycloak group ID
  numberOfStacks: number;
  stackAssignments: StackAssignment[];
  localGroups: LocalStudentGroup[];
  parameters: Record<string, any>;
}
