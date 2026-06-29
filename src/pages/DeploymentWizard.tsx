import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Server,
  Settings,
  Network,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Badge } from "../components/ui/badge";
import {
  getTemplate,
  getTemplateVersion,
  getTemplateVersions,
  type TemplateDto,
  type TemplateVersionDto,
  type TemplateParameter,
  type UserFileDefinition,
} from "../api/templates";
import {
  getKeycloakGroups,
  getKeycloakGroupMembers,
  type KeycloakGroup,
  type KeycloakUser,
} from "../api/keycloak";
import {
  createDeployment,
  type DeploymentCreateRequest,
} from "../api/deployments";
import {
  getMyCourses,
  getCourseGroups,
  createCourseGroup,
} from "../api/courses";
import { GroupManager, type StudentGroup } from "../components/GroupManager";
import keycloak from "../auth/keycloak";
import { useActiveOpenstackProject } from "../contexts/OpenstackProjectContext";

// GroupStackAssignment type (no UI component needed, auto-assignment in background)
export interface GroupStackAssignment {
  stackId: string;
  stackName: string;
  assignedGroups: StudentGroup[];
}

// Pre-fill payload used by the "retry failed deployment" flow: we drop the
// user onto the overview step with everything already wired up so they can
// confirm without re-entering anything. Reconstructed from the failed
// deployment's stored `deployment_parameters` JSON by DeploymentDetailsPage.
export interface DeploymentWizardInitialState {
  deploymentName: string;
  templateVersionId: string;
  keycloakGroupId: string;
  runtimeMonths?: number;
  parameters: Record<string, any>;
  studentGroups: StudentGroup[];
  groupStackAssignments: GroupStackAssignment[];
}

interface DeploymentWizardProps {
  templateId: string;
  onCancel: () => void;
  onComplete: (deploymentId: string) => void;
  /**
   * If provided, the wizard hydrates state from this payload and jumps the
   * user directly to the overview step. Used by the "Erneut versuchen" flow
   * on the deployment details page so a failed deployment can be re-submitted
   * without re-entering any data.
   */
  initialState?: DeploymentWizardInitialState;
}

export function DeploymentWizard({
  templateId,
  onCancel,
  onComplete,
  initialState,
}: DeploymentWizardProps) {
  const { activeProjectId } = useActiveOpenstackProject();
  const [isDeploying, setIsDeploying] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Initial-state hydration (retry-failed-deployment flow). When provided we
  // seed every relevant state slot with the failed deployment's values and
  // jump straight to the overview step, bypassing the wizard's auto-derive
  // effects on first render via `hasInitialStateRef`.
  const hasInitialStateRef = useRef(!!initialState);
  const [currentStep, setCurrentStep] = useState(0);

  // Data loading states
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateDto | null>(
    null,
  );
  const [keycloakGroups, setKeycloakGroups] = useState<KeycloakGroup[]>([]);
  const [keycloakMembers, setKeycloakMembers] = useState<KeycloakUser[]>([]);
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>(
    () => initialState?.studentGroups ?? [],
  );
  const [groupStackAssignments, setGroupStackAssignments] = useState<
    GroupStackAssignment[]
  >(() => initialState?.groupStackAssignments ?? []);
  const [numberOfStacks, setNumberOfStacks] = useState<number>(
    () => initialState?.groupStackAssignments?.length || 1,
  );
  const [numberOfGroups, setNumberOfGroups] = useState<number>(
    () => initialState?.studentGroups?.length || 1,
  );
  // Raw string inputs for the number fields. We keep these separate from the
  // numeric state so the user can transiently clear the field (e.g. backspace
  // the existing "1" before typing "2") without us ever pushing a 0 into the
  // DOM. A 0 would otherwise trip the browser's native min="1" validation and
  // show a "Wert muss größer als oder gleich 1 sein" tooltip mid-edit.
  const [numberOfStacksInput, setNumberOfStacksInput] = useState<string>(
    () => String(initialState?.groupStackAssignments?.length || 1),
  );
  const [numberOfGroupsInput, setNumberOfGroupsInput] = useState<string>(
    () => String(initialState?.studentGroups?.length || 1),
  );
  const [templateVersions, setTemplateVersions] = useState<
    TemplateVersionDto[]
  >([]);
  const [templateVersionData, setTemplateVersionData] =
    useState<TemplateVersionDto | null>(null);
  const [loading, setLoading] = useState({
    template: true,
    groups: true,
    version: false,
    members: false,
  });
  const [error, setError] = useState<string | null>(null);
  

  // Selection states
  const [selectedVersionId, setSelectedVersionId] = useState<string>(
    () => initialState?.templateVersionId ?? "",
  );
  const [selectedKeycloakGroupId, setSelectedKeycloakGroupId] =
    useState<string>(() => initialState?.keycloakGroupId ?? "");
  // Interne course_id (UUID aus `courses.id` im appstore-backend), die zur
  // ausgewählten Keycloak-Group passt. Brauchen wir, um beim Submit pro
  // Wizard-Gruppe eine `course_groups`-Row zu erzeugen/finden und deren
  // `id` als `course_group_id` ins Deployment-Payload zu legen — ohne
  // diese ID können Studenten ihre Credentials nicht über /api/v1/student/
  // sehen. Null, solange noch nicht aufgelöst oder kein Match existiert.
  const [internalCourseId, setInternalCourseId] = useState<string | null>(null);
  const [deploymentName, setDeploymentName] = useState<string>(
    () => initialState?.deploymentName ?? "",
  );
  const [runtime, setRuntime] = useState<string>(
    () => (initialState?.runtimeMonths ? String(initialState.runtimeMonths) : "4"),
  );
  const [deploymentMode] = useState<
    "per_group" | "per_student" | "per_course"
  >("per_group");

  // Form values - stores all parameter values
  const [formValues, setFormValues] = useState<Record<string, any>>(
    () => initialState?.parameters ?? {},
  );

  // Uploaded files - stores File objects keyed by user_file name
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});

  // Load template and Keycloak groups on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading({
          template: true,
          groups: true,
          version: false,
          members: false,
        });
        setError(null);

        const [templateRes, groupsRes] = await Promise.all([
          getTemplate(templateId),
          getKeycloakGroups(),
        ]);

        setSelectedTemplate(templateRes.data);
        setKeycloakGroups(groupsRes.data);
        setLoading({
          template: false,
          groups: false,
          version: false,
          members: false,
        });
      } catch (err) {
        console.error("Failed to load data:", err);
        setError(
          err instanceof Error ? err.message : "Fehler beim Laden der Daten",
        );
        setLoading({
          template: false,
          groups: false,
          version: false,
          members: false,
        });
      }
    };

    loadData();
  }, [templateId]);

  // Load template versions and auto-select active version
  useEffect(() => {
    if (!templateId) return;

    const loadVersions = async () => {
      try {
        setLoading((prev) => ({ ...prev, version: true }));
        const res = await getTemplateVersions(templateId, false);
        setTemplateVersions(res.data);

        // Auto-select the active version (or latest if no active). In the
        // retry flow `initialState.templateVersionId` already seeded the
        // selection — leave it alone so we re-deploy with the same version.
        const activeVersion = res.data.find((v) => v.is_active);
        const latestVersion = res.data.length > 0 ? res.data[0] : null;
        const versionToSelect = activeVersion || latestVersion;

        if (versionToSelect && !initialState?.templateVersionId) {
          setSelectedVersionId(versionToSelect.id);
        }

        setLoading((prev) => ({ ...prev, version: false }));
      } catch (err) {
        console.error("Failed to load template versions:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Fehler beim Laden der Versionen",
        );
        setLoading((prev) => ({ ...prev, version: false }));
      }
    };

    loadVersions();
  }, [templateId]);

  // Function to load Keycloak group members
  const loadKeycloakGroupMembers = useCallback(async () => {
    if (!selectedKeycloakGroupId) return;

    try {
      setLoading((prev) => ({ ...prev, members: true }));
      const res = await getKeycloakGroupMembers(selectedKeycloakGroupId);
      setKeycloakMembers(res.data);
      setLoading((prev) => ({ ...prev, members: false }));
    } catch (err) {
      console.error("Failed to load group members:", err);
      setError(
        err instanceof Error ? err.message : "Fehler beim Laden der Studenten",
      );
      setLoading((prev) => ({ ...prev, members: false }));
    }
  }, [selectedKeycloakGroupId]);

  // Load members when group is selected
  useEffect(() => {
    if (!selectedKeycloakGroupId) {
      setKeycloakMembers([]);
      setStudentGroups([]);
      setGroupStackAssignments([]);
      return;
    }
    loadKeycloakGroupMembers();
  }, [selectedKeycloakGroupId, loadKeycloakGroupMembers]);

  // Resolve the internal `courses.id` for the chosen Keycloak group. We need
  // this to create/find `course_groups` rows on submit. Falls fehlschlägt,
  // bleibt internalCourseId null — der Wizard deployt dann ohne
  // course_group_id (Backwards-Compat: Backend macht ein Best-Effort-Backfill
  // über Name, aber Studenten könnten ihre Credentials verlieren).
  useEffect(() => {
    if (!selectedKeycloakGroupId) {
      setInternalCourseId(null);
      return;
    }
    let cancelled = false;
    getMyCourses({
      page: 1,
      page_size: 200,
      openstack_project_id: activeProjectId,
    })
      .then((resp) => {
        if (cancelled) return;
        const match = (resp.data || []).find(
          (c) => c.keycloak_course_id === selectedKeycloakGroupId,
        );
        setInternalCourseId(match?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setInternalCourseId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedKeycloakGroupId, activeProjectId]);

  // Auto-create groups and stacks when deployment mode or members change.
  // Skipped on the very first run when `initialState` was supplied (retry
  // flow) so the pre-filled student groups / stack assignments survive the
  // initial members load — the user re-confirms exactly what failed.
  useEffect(() => {
    if (hasInitialStateRef.current) {
      hasInitialStateRef.current = false;
      return;
    }
    if (deploymentMode === "per_student" && keycloakMembers.length > 0) {
      // One group per student, one stack per group
      const groups = keycloakMembers.map((student) => ({
        groupId: `group-${student.id}`,
        groupName:
          `G_${student.firstName || student.username || "Student"} ${student.lastName || ""}`.trim(),
        students: [student],
      }));
      setStudentGroups(groups);
      setNumberOfGroups(groups.length);

      const stacks = groups.map((group, index) => ({
        stackId: `stack-${index + 1}`,
        stackName: `Stack ${index + 1}`,
        assignedGroups: [group],
      }));
      setGroupStackAssignments(stacks);
      setNumberOfStacks(stacks.length);
    } else if (deploymentMode === "per_course" && keycloakMembers.length > 0) {
      // One group with all students, one stack
      const courseGroup = [
        {
          groupId: "group-course",
          groupName: "Kurs Gruppe",
          students: [...keycloakMembers],
        },
      ];
      setStudentGroups(courseGroup);
      setNumberOfGroups(1);

      const courseStack = [
        {
          stackId: "stack-1",
          stackName: "Kurs Stack",
          assignedGroups: courseGroup,
        },
      ];
      setGroupStackAssignments(courseStack);
      setNumberOfStacks(1);
    } else if (deploymentMode === "per_group" && keycloakMembers.length > 0) {
      // Manual mode - initialize empty groups if needed
      if (studentGroups.length === 0) {
        const groups = Array.from({ length: numberOfGroups }).map((_, i) => ({
          groupId: `group-${i + 1}`,
          groupName: `Gruppe ${i + 1}`,
          students: [],
        }));
        setStudentGroups(groups);
      }
      // Initialize stacks if needed
      if (groupStackAssignments.length === 0 && numberOfStacks > 0) {
        const stacks = Array.from({ length: numberOfStacks }).map((_, i) => ({
          stackId: `stack-${i + 1}`,
          stackName: `Stack ${i + 1}`,
          assignedGroups: [],
        }));
        setGroupStackAssignments(stacks);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentMode, keycloakMembers, numberOfStacks, numberOfGroups]);

 // Helper function to validate and apply group count
  const validateAndApplyGroupCount = useCallback(() => {
    // Read from the raw string input so an empty/invalid value falls back to
    // 1 instead of getting stuck at whatever transient state the numeric
    // setter had during typing.
    const parsed = parseInt(numberOfGroupsInput, 10);
    const value = Math.max(
      1,
      Math.min(50, Number.isFinite(parsed) ? Math.floor(parsed) : 1),
    );
    setNumberOfGroups(value);
    setNumberOfGroupsInput(String(value));

    // Update studentGroups to match the new count
    const currentGroupCount = studentGroups.length;
    let updatedGroups = [...studentGroups];

    if (value > currentGroupCount) {
      // Add new empty groups
      for (let i = currentGroupCount; i < value; i++) {
        updatedGroups.push({
          groupId: `group-${i + 1}`,
          groupName: `Gruppe ${i + 1}`,
          students: [],
        });
      }
    } else if (value < currentGroupCount) {
      // Remove groups from the end
      updatedGroups = updatedGroups.slice(0, value);
    }

    setStudentGroups(updatedGroups);
  }, [numberOfGroupsInput, studentGroups]);

  // Helper function to validate and apply stack count
  const validateAndApplyStackCount = useCallback(() => {
    const parsed = parseInt(numberOfStacksInput, 10);
    const value = Math.max(
      1,
      Math.min(50, Number.isFinite(parsed) ? Math.floor(parsed) : 1),
    );
    setNumberOfStacks(value);
    setNumberOfStacksInput(String(value));
    // Initialize stacks
    const stacks = Array.from({ length: value }).map((_, i) => ({
      stackId: `stack-${i + 1}`,
      stackName: `Stack ${i + 1}`,
      assignedGroups: [],
    }));
    setGroupStackAssignments(stacks);
  }, [numberOfStacksInput]);

  // Helper function to sanitize deployment name. We mirror the backend's stack
  // naming rules (deploy_tasks.py: lowercases the value and appends a
  // ``-s{idx}-{deploymentId[:4]}`` suffix before truncating to 64 chars), so we
  // lowercase here and replace umlauts / underscores / whitespace inline. Names
  // typed by lecturers are converted to ASCII-only kebab-case as they type,
  // making the eventual Heat stack name predictable.
  const sanitizeDeploymentName = (name: string): string => {
    return name
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/Ä/g, "ae")
      .replace(/Ö/g, "oe")
      .replace(/Ü/g, "ue")
      .replace(/ß/g, "ss")
      .toLowerCase()
      .replace(/[\s_]+/g, "-");
  };

  // Backend appends ``-s{idx}-{deploymentId[:4]}`` (8 chars) then truncates the
  // resulting Heat stack name to 64. Cap user input well below that so multiple
  // stacks remain distinguishable.
  const DEPLOYMENT_NAME_MAX = 55;

  // Helper function to validate deployment name pattern. Aligned with the
  // DNS-1123 shape Heat ultimately accepts after backend lowercasing.
  const validateDeploymentNamePattern = (name: string): { valid: boolean; message?: string } => {
    const pattern = new RegExp(`^[a-z][a-z0-9-]{0,${DEPLOYMENT_NAME_MAX - 1}}$`);

    if (!name || name.trim() === "") {
      return { valid: false, message: "Ein Deployment-Name ist erforderlich" };
    }

    if (!pattern.test(name)) {
      return {
        valid: false,
        message: `Deployment-Name muss mit einem Kleinbuchstaben beginnen und darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten (max. ${DEPLOYMENT_NAME_MAX} Zeichen)`,
      };
    }

    return { valid: true };
  };

  // Validation function for step 0
  const validateStep0 = useCallback((): boolean => {
    const errors: string[] = [];

    // Check deployment name
    const nameValidation = validateDeploymentNamePattern(deploymentName);
    if (!nameValidation.valid) {
      errors.push(nameValidation.message || "Ein Deployment-Name ist erforderlich");
    }

    // Check if template and group are selected
    if (!selectedVersionId) {
      errors.push("Eine Template-Version muss ausgewählt werden");
    }
    if (!selectedKeycloakGroupId) {
      errors.push("Ein Kurs muss ausgewählt werden");
    }

    // Leere Gruppen sind erlaubt (z. B. Dozent legt Platzhalter an, oder eine
    // Gruppe bekommt erst später Studenten). Ebenso müssen nicht zwingend alle
    // Keycloak-Mitglieder einer Wizard-Gruppe zugeordnet sein — ein Student
    // ohne Gruppe sieht im Student-Dashboard schlicht kein Deployment.
    // → Keine per-Gruppe-Validierung hier.

    setValidationErrors(errors);
    return errors.length === 0;
  }, [deploymentName, selectedVersionId, selectedKeycloakGroupId]);

  // Pure check for whether step 0 is sufficiently filled to allow navigation
  const isStep0ValidPure = useCallback((): boolean => {
    // basic required fields
    if (!deploymentName || deploymentName.trim() === "") return false;
    if (!selectedVersionId) return false;
    if (!selectedKeycloakGroupId) return false;

    // validate name pattern
    if (!validateDeploymentNamePattern(deploymentName).valid) return false;

    // Pendant zur Validierung oben: leere Gruppen und nicht-zugeordnete
    // Studenten sind kein Blocker mehr.

    return true;
  }, [deploymentName, selectedVersionId, selectedKeycloakGroupId]);

  // Update validation errors whenever relevant data changes (on current step)
  useEffect(() => {
    if (currentStep === 0) {
      validateStep0();
    }
  }, [deploymentName, selectedVersionId, selectedKeycloakGroupId, deploymentMode, keycloakMembers, studentGroups, currentStep, validateStep0]);

  // Update numberOfGroups when studentGroups changes (for UI consistency).
  // Keep a sensible default of 1 while no groups have been created yet,
  // so the input shows "1" instead of "0" on first open.
  useEffect(() => {
    const next = studentGroups.length > 0 ? studentGroups.length : 1;
    setNumberOfGroups(next);
    setNumberOfGroupsInput(String(next));
  }, [studentGroups.length]);

  // Auto-update group names when only one student is in a group
  useEffect(() => {
    const updatedGroups = studentGroups.map((group, groupIndex) => {
      // If group has exactly one student
      if (group.students.length === 1) {
        const student = group.students[0];
        const firstName = student.firstName || student.username || "Student";
        const lastName = student.lastName || "";
        const studentName = `G_${firstName}${lastName ? "_" + lastName : ""}`;
        // Update name if it doesn't match the student name pattern
        if (!(student.firstName && group.groupName.includes(student.firstName)) && 
            !(student.lastName && group.groupName.includes(student.lastName))) {
          return { ...group, groupName: studentName };
        }
      } else if ((group.students.length !== 1 && group.groupName.startsWith("G_"))) {
        // If group doesn't have exactly one student and name starts with "G_", revert to generic name
        // Use the group index + 1 as the group number
        return { ...group, groupName: `Gruppe ${groupIndex + 1}` };
      }
      return group;
    });

    // Only update if something changed
    const hasChanges = updatedGroups.some((group, idx) => group.groupName !== studentGroups[idx].groupName);
    if (hasChanges) {
      setStudentGroups(updatedGroups);
    }
  }, [studentGroups]);

  // Auto-assign groups to stacks (balanced distribution in background)
  useEffect(() => {
    if (
      deploymentMode === "per_group" &&
      studentGroups.length > 0 &&
      groupStackAssignments.length > 0
    ) {
      // Filter groups that have students
      const groupsWithStudents = studentGroups.filter(
        (g) => g.students.length > 0,
      );

      if (groupsWithStudents.length === 0) return;

      // Distribute groups evenly across stacks
      const groupsPerStack = Math.ceil(
        groupsWithStudents.length / groupStackAssignments.length,
      );
      const updatedStacks = groupStackAssignments.map((stack, index) => ({
        ...stack,
        assignedGroups: groupsWithStudents.slice(
          index * groupsPerStack,
          (index + 1) * groupsPerStack,
        ),
      }));

      setGroupStackAssignments(updatedStacks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentGroups, deploymentMode]);

  // One-shot guard: keep the failed deployment's parameters when the template
  // version data first loads in the retry flow, otherwise the default-init
  // loop below would wipe them with the template defaults.
  const preserveInitialFormValuesRef = useRef(!!initialState);

  // Load template version data when version is selected
  useEffect(() => {
    if (!selectedVersionId) {
      setTemplateVersionData(null);
      setFormValues({});
      return;
    }

    const loadVersionData = async () => {
      try {
        setLoading((prev) => ({ ...prev, version: true }));
        const res = await getTemplateVersion(selectedVersionId);
        setTemplateVersionData(res.data);

        if (preserveInitialFormValuesRef.current) {
          // Retry flow: parameters are already seeded from the failed
          // deployment; don't overwrite with template defaults.
          preserveInitialFormValuesRef.current = false;
        } else {
          // Initialize form values with defaults
          const initialValues: Record<string, any> = {};
          res.data.parameters?.forEach((param: TemplateParameter) => {
            if (param.default !== undefined && param.default !== null) {
              initialValues[param.name] = param.default;
            }
          });
          setFormValues(initialValues);
        }

        setLoading((prev) => ({ ...prev, version: false }));
      } catch (err) {
        console.error("Failed to load template version:", err);
        setError(
          err instanceof Error ? err.message : "Fehler beim Laden der Version",
        );
        setLoading((prev) => ({ ...prev, version: false }));
      }
    };

    loadVersionData();
  }, [selectedVersionId, templateId]);

  // Group parameters by step
  const parametersByStep = useMemo(() => {
    if (!templateVersionData?.parameters) return {};

    const grouped: Record<string, TemplateParameter[]> = {
      konfiguration: [],
      netzwerk: [],
    };

    templateVersionData.parameters.forEach((param: TemplateParameter) => {
      // Group network-related parameters
      if (
        param.name.toLowerCase().includes("network") ||
        param.name.toLowerCase().includes("subnet") ||
        param.name.toLowerCase().includes("port") ||
        param.name.toLowerCase().includes("ip")
      ) {
        grouped.netzwerk.push(param);
      } else {
        grouped.konfiguration.push(param);
      }
    });

    return grouped;
  }, [templateVersionData]);

  // Define wizard steps
  const steps = useMemo(() => {
    const baseSteps = [
      {
        name: "Template & Zugriff",
        stepKey: "template",
        description: "Wählen Sie Version und Kurs aus",
        icon: Server,
      },
    ];

    // Add configuration step if there are config parameters
    if (parametersByStep.konfiguration?.length > 0) {
      baseSteps.push({
        name: "Konfiguration",
        stepKey: "konfiguration",
        description: "Passen Sie die Anwendungsparameter an",
        icon: Settings,
      });
    }

    // Add network step if there are network parameters
    if (parametersByStep.netzwerk?.length > 0) {
      baseSteps.push({
        name: "Netzwerk",
        stepKey: "netzwerk",
        description: "Konfigurieren Sie Netzwerkeinstellungen",
        icon: Network,
      });
    }

    // Add file upload step if template supports user files
    if (templateVersionData?.allow_user_files && templateVersionData?.user_files?.length) {
      baseSteps.push({
        name: "Dateien",
        stepKey: "dateien",
        description: "Laden Sie optionale Dateien für die Gruppen hoch",
        icon: Upload,
      });
    }

    // Always add overview step
    baseSteps.push({
      name: "Übersicht",
      stepKey: "overview",
      description: "Überprüfen Sie Ihre Einstellungen",
      icon: CheckCircle2,
    });

    return baseSteps;
  }, [parametersByStep]);

  // Retry flow: jump to the overview (last step) as soon as the wizard knows
  // *all* its steps. We wait for `templateVersionData` because the
  // configuration/network steps depend on it — if we jumped earlier we'd
  // land on whatever step index the overview *had* before those got
  // inserted, which on most templates means the user ends up on
  // "Konfiguration" instead of "Übersicht".
  const didJumpToOverviewRef = useRef(false);
  useEffect(() => {
    if (
      initialState &&
      !didJumpToOverviewRef.current &&
      templateVersionData &&
      steps.length > 1
    ) {
      setCurrentStep(steps.length - 1);
      didJumpToOverviewRef.current = true;
    }
  }, [initialState, templateVersionData, steps.length]);

  const handleNext = () => {
    // Validate step 0 before proceeding
    if (currentStep === 0) {
      if (!validateStep0()) {
        return; // Don't proceed if validation fails
      }
    }
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkipToOverview = () => {
    // Jump directly to the last step (overview)
    setCurrentStep(steps.length - 1);
  };

  const handleParameterChange = (paramName: string, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [paramName]: value,
    }));
  };

  const handleDeploy = async () => {
    if (
      !selectedVersionId ||
      !selectedKeycloakGroupId ||
      !deploymentName.trim()
    ) {
      setError("Bitte füllen Sie alle erforderlichen Felder aus");
      return;
    }

    if (deploymentMode === "per_group") {
      if (studentGroups.length === 0) {
        setError("Bitte erstellen Sie mindestens eine Gruppe");
        return;
      }
      // Leere Gruppen sind bewusst erlaubt — Dozent kann später Studenten
      // nachziehen, oder das Deployment dient als Platzhalter/Testlauf.
      if (groupStackAssignments.length === 0) {
        setError("Bitte erstellen Sie mindestens einen Stack");
        return;
      }
      if (groupStackAssignments.every((s) => s.assignedGroups.length === 0)) {
        setError("Bitte weisen Sie mindestens einem Stack Gruppen zu");
        return;
      }
    }

    if (
      (deploymentMode === "per_student" || deploymentMode === "per_course") &&
      groupStackAssignments.length === 0
    ) {
      setError("Keine Stack-Zuweisungen gefunden");
      return;
    }

    setIsDeploying(true);
    setError(null);

    try {
      if (!templateVersionData?.parameters) {
        setError("Template-Parameter konnten nicht geladen werden");
        setIsDeploying(false);
        return;
      }

      // Build heat_parameters
      const heatParameters: Record<string, any> = {};

      // Set default values
      templateVersionData.parameters.forEach((param: TemplateParameter) => {
        if (param.default !== undefined && param.default !== null) {
          heatParameters[param.name] = param.default;
        }
      });

      // Override with user values
      Object.keys(formValues).forEach((key) => {
        const userValue = formValues[key];
        if (userValue !== null && userValue !== undefined && userValue !== "") {
          heatParameters[key] = userValue;
        }
      });

      // Special handling for stack_label
      if (deploymentName.trim()) {
        const stackLabelSlug = deploymentName
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9-]/g, "");
        if (stackLabelSlug) {
          heatParameters.stack_label = stackLabelSlug;
        }
      }

      // Get teacher info from keycloak
      const teacherInfo = keycloak?.tokenParsed
        ? {
            id: keycloak.tokenParsed.sub || "",
            username: keycloak.tokenParsed.preferred_username || "",
            email: keycloak.tokenParsed.email || "",
            first_name: keycloak.tokenParsed.given_name || "",
            last_name: keycloak.tokenParsed.family_name || "",
          }
        : {
            id: "",
            username: "",
            email: "",
            first_name: "",
            last_name: "",
          };

      console.log("=== TEACHER INFO DEBUG ===");
      console.log("Keycloak authenticated:", keycloak?.authenticated);
      console.log("Keycloak tokenParsed:", keycloak?.tokenParsed);
      console.log("Teacher Info:", teacherInfo);
      console.log("========================");

      // Validate teacher info
      if (!teacherInfo.id || !teacherInfo.username || !teacherInfo.email) {
        setError("Lehrer-Informationen konnten nicht aus dem Keycloak-Token gelesen werden. Bitte loggen Sie sich erneut ein.");
        setIsDeploying(false);
        return;
      }

      // Backend pins the deployment to the user's active OpenStack project so
      // later restart/delete uses the right credentials even if the user
      // switches their clouds.yaml. Teachers must have one — the App-level
      // setup gate normally prevents this branch, but be defensive.
      if (!activeProjectId) {
        setError("Kein aktives OpenStack-Projekt. Bitte richten Sie zuerst ein OpenStack-Projekt ein.");
        setIsDeploying(false);
        return;
      }

      // Convert uploaded files to base64
      const userFilesPayload: Record<string, string> = {};
      for (const [name, file] of Object.entries(uploadedFiles)) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        userFilesPayload[name] = base64;
      }

      // Pro Wizard-Group eine course_groups-Row sicherstellen. Backend stempelt
      // die FK dann auf alle generierten Credential-Rows, was Studenten den
      // Zugriff via /api/v1/student/* freigibt. Ohne diesen Schritt bleibt
      // group_id NULL und Studenten sehen nichts.
      //
      // Strategie: existierende course_groups holen, per Name matchen,
      // unbekannte Namen via POST anlegen. Ein Toast/Error blockt das Deploy
      // bewusst — wenn der Course-Group-Mechanismus kaputt ist, will der
      // Lecturer das sofort wissen, statt erst nach dem Deploy bei Student-
      // Reports zu merken, dass Credentials unsichtbar sind.
      const wizardGroupToCourseGroupId = new Map<string, string>();
      if (internalCourseId) {
        try {
          const existingResp = await getCourseGroups(internalCourseId);
          const byName = new Map<string, string>();
          for (const g of existingResp.data || []) {
            byName.set(g.name, g.id);
          }
          // Sammeln aller distinct Wizard-Group-Namen (nach Group-ID, da der
          // gleiche Name nicht mehrfach in einem Stack vorkommen sollte, aber
          // wir bleiben defensiv).
          const distinctWizardGroups = new Map<string, { id: string; name: string }>();
          for (const stack of groupStackAssignments) {
            for (const g of stack.assignedGroups) {
              distinctWizardGroups.set(g.groupId, {
                id: g.groupId,
                name: g.groupName,
              });
            }
          }
          for (const wg of distinctWizardGroups.values()) {
            const existingId = byName.get(wg.name);
            if (existingId) {
              wizardGroupToCourseGroupId.set(wg.id, existingId);
              continue;
            }
            const created = await createCourseGroup(internalCourseId, wg.name);
            wizardGroupToCourseGroupId.set(wg.id, created.data.id);
            // Cache für den Fall, dass mehrere Wizard-Groups denselben Namen
            // tragen — sollte nicht passieren, aber wir reusen die ID.
            byName.set(wg.name, created.data.id);
          }
        } catch (err) {
          console.error("Course-group resolution failed:", err);
          setError(
            "Die Kursgruppen konnten nicht angelegt werden. Studenten würden ihre Credentials nicht sehen — Deployment wurde abgebrochen.",
          );
          setIsDeploying(false);
          return;
        }
      }

      // Build deployment request with stack assignments
      const deploymentData: DeploymentCreateRequest = {
        name: deploymentName.trim(),
        template_version_id: selectedVersionId,
        course_id: selectedKeycloakGroupId,
        openstack_project_id: activeProjectId,
        // Wizard runtime select holds a stringified value; backend expects an
        // integer from ALLOWED_RUNTIME_MONTHS (1/3/4/6/12/24). Cast is safe
        // because the <Select> options are constrained to those values.
        runtime_months: parseInt(runtime, 10) as DeploymentCreateRequest["runtime_months"],
        parameters: heatParameters,
        ...(Object.keys(userFilesPayload).length > 0 && { user_files: userFilesPayload }),
        stack_assignments: groupStackAssignments.map((stack, stackIndex) => ({
          groups: stack.assignedGroups.map((group) => ({
            group_name: group.groupName,
            group_index: group.groupId ? parseInt(group.groupId.replace(/\D/g, '')) || stackIndex + 1 : stackIndex + 1,
            // Auflösung aus dem Map oben. Null, wenn kein internalCourseId
            // ermittelt werden konnte (kein Course für die Keycloak-Group):
            // Backend hat dafür einen Backfill-Versuch, aber Studenten sehen
            // ggf. nichts. Lecturer-Flow funktioniert unverändert.
            course_group_id: wizardGroupToCourseGroupId.get(group.groupId) ?? null,
            students: group.students.map((student) => ({
              id: student.id,
              username: student.username || "",
              email: student.email || "",
              first_name: student.firstName || "",
              last_name: student.lastName || "",
            })),
          })),
        })),
        teacher: teacherInfo,
      };

      console.log("=== DEPLOYMENT DEBUG ===");
      console.log("Selected Keycloak Group ID:", selectedKeycloakGroupId);
      console.log("Student Groups:", studentGroups);
      console.log("Group Stack Assignments:", groupStackAssignments);
      console.log("Deployment Data:", JSON.stringify(deploymentData, null, 2));
      console.log("========================");

      const deployment = await createDeployment(deploymentData as any);

      console.log("Deployment created successfully:", deployment.data);
      onComplete(deployment.data.id);
    } catch (err) {
      console.error("Deployment failed:", err);
      setError(err instanceof Error ? err.message : "Fehler beim Deployment");
    } finally {
      setIsDeploying(false);
    }
  };

  const renderParameterField = (param: TemplateParameter) => {
    let value = formValues[param.name];
    if (value === undefined || value === null) {
      value = param.default;
    }
    if (value === undefined || value === null) {
      if (param.type === "boolean") {
        value = false;
      } else if (param.type === "number") {
        value = "";
      } else {
        value = "";
      }
    }

    const fieldId = `param-${param.name}`;

    // Handle enum (dropdown)
    if (param.enum && param.enum.length > 0) {
      return (
        <div key={param.name} className="space-y-2">
          <Label htmlFor={fieldId}>
            {param.label || param.name}
            {param.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Select
            value={String(value || "")}
            onValueChange={(val: any) => handleParameterChange(param.name, val)}
            disabled={param.hidden}
          >
            <SelectTrigger id={fieldId} className={param.hidden ? "bg-slate-50" : ""}>
              <SelectValue
                placeholder={`Wählen Sie ${param.label || param.name}`}
              />
            </SelectTrigger>
            <SelectContent>
              {param.enum.map((option) => (
                <SelectItem key={String(option)} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {param.description && (
            <p className="text-xs text-slate-500">{param.description}</p>
          )}
        </div>
      );
    }

    // Handle boolean (switch)
    if (param.type === "boolean") {
      return (
        <div
          key={param.name}
          className={`flex items-center justify-between p-4 rounded-lg ${param.hidden ? 'bg-slate-100' : 'bg-slate-50'}`}
        >
          <div className="flex-1">
            <Label htmlFor={fieldId}>
              {param.label || param.name}
              {param.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            {param.description && (
              <p className="text-xs text-slate-500 mt-1">{param.description}</p>
            )}
          </div>
          <Switch
            id={fieldId}
            checked={
              value === true || value === "true" || value === 1 || value === "1"
            }
            onCheckedChange={(checked: any) =>
              handleParameterChange(param.name, checked)
            }
            disabled={param.hidden}
          />
        </div>
      );
    }

    // Handle number
    if (param.type === "number") {
      const minValue =
        typeof param.min === "number"
          ? param.min
          : param.name === "pw_min_length"
            ? 6
            : undefined;
      const maxValue =
        typeof param.max === "number"
          ? param.max
          : param.name === "pw_min_length"
            ? 64
            : undefined;
      const rangeHint =
        typeof minValue === "number" || typeof maxValue === "number"
          ? `Erlaubter Bereich: ${minValue ?? "-"}–${maxValue ?? "-"}`
          : null;

      return (
        <div key={param.name} className="space-y-2">
          <Label htmlFor={fieldId}>
            {param.label || param.name}
            {param.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Input
            id={fieldId}
            type="number"
            value={value}
            min={minValue}
            max={maxValue}
            onChange={(e) => {
              if (!e.target.value) {
                handleParameterChange(param.name, "");
                return;
              }

              let nextValue = Number(e.target.value);
              if (Number.isNaN(nextValue)) {
                handleParameterChange(param.name, "");
                return;
              }

              if (typeof minValue === "number") {
                nextValue = Math.max(minValue, nextValue);
              }
              if (typeof maxValue === "number") {
                nextValue = Math.min(maxValue, nextValue);
              }

              handleParameterChange(param.name, nextValue);
            }}
            placeholder={
              param.description || `Geben Sie ${param.label || param.name} ein`
            }
            disabled={param.hidden}
            readOnly={param.hidden}
            className={param.hidden ? "bg-slate-50" : ""}
          />
          {param.description && (
            <p className="text-xs text-slate-500">{param.description}</p>
          )}
          {rangeHint && (
            <p className="text-xs text-slate-500">{rangeHint}</p>
          )}
        </div>
      );
    }

    // Handle text/string (default)
    return (
      <div key={param.name} className="space-y-2">
        <Label htmlFor={fieldId}>
          {param.label || param.name}
          {param.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        <Input
          id={fieldId}
          type="text"
          value={value}
          onChange={(e) => handleParameterChange(param.name, e.target.value)}
          placeholder={
            param.description || `Geben Sie ${param.label || param.name} ein`
          }
          disabled={param.hidden}
          readOnly={param.hidden}
          className={param.hidden ? "bg-slate-50" : ""}
        />
        {param.description && (
          <p className="text-xs text-slate-500">{param.description}</p>
        )}
      </div>
    );
  };

  const renderStepContent = () => {
    const currentStepData = steps[currentStep];
    if (!currentStepData) return null;

    // Template selection step
    if (currentStepData.stepKey === "template") {
      return (
        <div className="space-y-6">
          {/* Template Info (read-only) */}
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-slate-500">Template</Label>
                <p className="text-sm font-medium text-slate-900 mt-1">
                  {selectedTemplate?.name || "Lädt..."}
                </p>
              </div>
            </div>
            {selectedTemplate?.description && (
              <p className="text-xs text-slate-600 mt-2">
                {selectedTemplate.description}
              </p>
            )}
          </div>


          {/* Section 1: Basics */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Grundeinstellungen</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-6">
            <div>
            <Label>Version</Label>
            <Select
              value={selectedVersionId}
              onValueChange={setSelectedVersionId}
              disabled={loading.version || templateVersions.length === 0}
            >
              <SelectTrigger className="mt-2">
                <SelectValue
                  placeholder={
                    loading.version
                      ? "Lädt..."
                      : templateVersions.length === 0
                        ? "Keine Versionen verfügbar"
                        : "Version auswählen"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {templateVersions.map((version) => (
                  <SelectItem key={version.id} value={version.id}>
                    {version.version}{" "}
                    {version.is_active && (
                      <Badge variant="secondary" className="ml-2">
                        Aktiv
                      </Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {loading.version && (
              <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <span>Lade Versionen...</span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="deployment-name">Deployment-Name</Label>
            {(() => {
              const nameValidation = validateDeploymentNamePattern(deploymentName);
              const showError = !!deploymentName && !nameValidation.valid;
              return (
                <>
                  <Input
                    id="deployment-name"
                    placeholder="z.B. cs101-jupyter-herbst2024"
                    maxLength={DEPLOYMENT_NAME_MAX}
                    className={`mt-2 ${
                      showError
                        ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                        : ""
                    }`}
                    value={deploymentName}
                    onChange={(e) => {
                      // Sanitize as the user types (umlauts, casing, spaces).
                      setDeploymentName(sanitizeDeploymentName(e.target.value));
                    }}
                  />
                  {showError && (
                    <p className="text-xs text-red-600 mt-1 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>{nameValidation.message}</span>
                    </p>
                  )}
                </>
              );
            })()}
          </div>

              <div>
                <Label>Laufzeit</Label>
                <Select value={runtime} onValueChange={setRuntime}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Monat</SelectItem>
                    <SelectItem value="3">3 Monate</SelectItem>
                    <SelectItem value="4">4 Monate</SelectItem>
                    <SelectItem value="6">6 Monate</SelectItem>
                    <SelectItem value="12">1 Jahr</SelectItem>
                    <SelectItem value="24">2 Jahre</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Nach Ablauf werden die Ressourcen automatisch freigegeben
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Groups */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Gruppen & Kurszuordnung</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-6">
              <div>
                <Label>Kurs auswählen</Label>
                <Select
                  value={selectedKeycloakGroupId}
                  onValueChange={setSelectedKeycloakGroupId}
                  disabled={loading.groups}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="z.B. WWI23SEB" />
                  </SelectTrigger>
                  <SelectContent>
                    {keycloakGroups.map((group) => (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-2">
                  Wählen Sie eine Keycloak-Gruppe (Kurs) aus
                </p>
              </div>

              <div>
                <Label>Anzahl der Gruppen</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  className="mt-2"
                  value={numberOfGroupsInput}
                  onChange={(e) => {
                    // Keep the raw string so the field may transiently be
                    // empty while the user is editing — normalization happens
                    // on blur / Enter via validateAndApplyGroupCount.
                    setNumberOfGroupsInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    // Validate and apply when Enter is pressed
                    if (e.key === "Enter") {
                      validateAndApplyGroupCount();
                    }
                  }}
                  onBlur={() => {
                    // Validate and apply when field loses focus
                    validateAndApplyGroupCount();
                  }}
                />
                <p className="text-xs text-slate-500 mt-2">
                  In wie viele Gruppen sollen die Studierenden aufgeteilt werden? Geben Sie eine Zahl von 1–50 an.
                </p>
              </div>

              {/* Group and Stack Assignment */}
              {selectedKeycloakGroupId && keycloakMembers.length > 0 && (
                <div>
                  {deploymentMode === "per_student" ? (
                    <Card className="border-teal-200 bg-teal-50">
                      <CardContent className="pt-2">
                        <div className="flex items-center gap-3 text-teal-900">
                          <CheckCircle2 className="w-5 h-5" />
                          <div>
                            <p className="text-sm font-medium">
                              Automatische Stack-Zuweisung aktiviert
                            </p>
                            <p className="text-xs text-teal-700 mt-1">
                              {keycloakMembers.length} Stack
                              {keycloakMembers.length !== 1 ? "s" : ""} werden
                              erstellt - ein Stack pro Student mit individuellen
                              Credentials
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : deploymentMode === "per_course" ? (
                    <Card className="border-blue-200 bg-blue-50">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 text-blue-900">
                          <CheckCircle2 className="w-5 h-5" />
                          <div>
                            <p className="text-sm font-medium">
                              Kurs-weites Deployment aktiviert
                            </p>
                            <p className="text-xs text-blue-700 mt-1">
                              1 Stack wird erstellt - alle {keycloakMembers.length}{" "}
                              Studenten teilen sich die gleichen Credentials
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-6">
                      {/* Gruppenverwaltung - Stack-Zuweisung erfolgt automatisch im Hintergrund */}
                      <GroupManager
                        students={keycloakMembers}
                        groups={studentGroups}
                        onGroupsChange={setStudentGroups}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Loading state for members */}
              {selectedKeycloakGroupId && loading.members && (
                <div className="flex items-center gap-2 text-slate-500">
                  <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Lade Studenten...</span>
                </div>
              )}

              {/* No members warning */}
              {selectedKeycloakGroupId &&
                !loading.members &&
                keycloakMembers.length === 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-xs text-amber-800 block">
                      Keine Studenten in dieser Gruppe gefunden.
                    </span>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Section 3: Server & Runtime */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900">Server-Konfiguration</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-6">
              <div>
                <Label>Anzahl der Server</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  className="mt-2"
                  value={numberOfStacksInput}
                  onChange={(e) => {
                    // Keep the raw string so the field may transiently be
                    // empty while the user is editing — normalization happens
                    // on blur / Enter via validateAndApplyStackCount.
                    setNumberOfStacksInput(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    // Validate and apply when Enter is pressed
                    if (e.key === "Enter") {
                      validateAndApplyStackCount();
                    }
                  }}
                  onBlur={() => {
                    // Validate and apply when field loses focus
                    validateAndApplyStackCount();
                  }}
                />
                <p className="text-xs text-slate-500 mt-2">
                  Wie viele separate Arbeitsumgebungen sollen erstellt werden? (1 = alle teilen sich eine Umgebung; mehrere = getrennte Umgebungen für Gruppen/Studierende)
                </p>
              </div>
            </CardContent>
          </Card>

          {loading.version && (
            <div className="flex items-center gap-2 text-slate-500">
              <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Lade Template-Version...</span>
            </div>
          )}
        </div>
      );
    }

    // File upload step
    if (currentStepData.stepKey === "dateien") {
      const userFiles: UserFileDefinition[] = templateVersionData?.user_files ?? [];
      return (
        <div className="space-y-6">
          <p className="text-sm text-slate-500">
            Alle Felder sind optional. Dateien werden beim Deployment auf die VMs kopiert.
          </p>
          {userFiles.map((fileDef) => {
            const uploaded = uploadedFiles[fileDef.name];
            return (
              <div key={fileDef.name} className="space-y-2">
                <Label htmlFor={`file-${fileDef.name}`}>
                  {fileDef.label ?? fileDef.name}
                  {fileDef.required && <span className="text-red-500 ml-1">*</span>}
                  {fileDef.mode === "per_group" && (
                    <span className="ml-2 text-xs text-slate-400">(pro Gruppe)</span>
                  )}
                </Label>
                {fileDef.description && (
                  <p className="text-xs text-slate-500">{fileDef.description}</p>
                )}
                <div className="flex items-center gap-3">
                  <label
                    htmlFor={`file-${fileDef.name}`}
                    className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50 text-sm"
                  >
                    <Upload className="w-4 h-4 text-slate-400" />
                    {uploaded ? uploaded.name : "Datei auswählen…"}
                  </label>
                  <input
                    id={`file-${fileDef.name}`}
                    type="file"
                    accept={fileDef.accept}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setUploadedFiles((prev) => ({ ...prev, [fileDef.name]: file }));
                      }
                    }}
                  />
                  {uploaded && (
                    <button
                      type="button"
                      className="text-xs text-red-400 hover:text-red-600"
                      onClick={() =>
                        setUploadedFiles((prev) => {
                          const next = { ...prev };
                          delete next[fileDef.name];
                          return next;
                        })
                      }
                    >
                      Entfernen
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Overview step
    if (currentStepData.stepKey === "overview") {
      const selectedGroup = keycloakGroups.find(
        (g) => g.id === selectedKeycloakGroupId,
      );
      const runtimeLabels: Record<string, string> = {
        "1": "1 Monat",
        "3": "3 Monate",
        "4": "4 Monate",
        "6": "6 Monate",
        "12": "1 Jahr",
        "24": "2 Jahre",
      };

      return (
        <div className="space-y-6">
          <div className="p-6 bg-gradient-to-br from-teal-50 to-blue-50 border border-teal-200 rounded-lg">
            <h3 className="text-slate-900 mb-4">Deployment-Zusammenfassung</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Template:</span>
                <span className="text-sm text-slate-900">
                  {selectedTemplate?.name || "-"}{" "}
                  {templateVersionData?.version
                    ? `(${templateVersionData.version})`
                    : ""}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Deployment-Name:</span>
                <span className="text-sm text-slate-900">
                  {deploymentName || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Gruppe:</span>
                <span className="text-sm text-slate-900">
                  {selectedGroup?.name || "-"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">
                  Deployment-Modus:
                </span>
                <span className="text-sm text-slate-900">
                  {deploymentMode === "per_group"
                    ? "Pro Gruppe"
                    : deploymentMode === "per_student"
                      ? "Pro Student"
                      : "Pro Kurs"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Anzahl Stacks:</span>
                <span className="text-sm text-slate-900">
                  {groupStackAssignments.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Anzahl Gruppen:</span>
                <span className="text-sm text-slate-900">
                  {studentGroups.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Studenten:</span>
                <span className="text-sm text-slate-900">
                  {keycloakMembers.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Credentials:</span>
                <span className="text-sm text-slate-900">
                  {deploymentMode === "per_student"
                    ? `${keycloakMembers.length} individuelle Sets`
                    : deploymentMode === "per_course"
                      ? "1 gemeinsames Set"
                      : `${studentGroups.filter((g) => g.students.length > 0).length} Gruppen-Sets`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Laufzeit:</span>
                <span className="text-sm text-slate-900">
                  {runtimeLabels[runtime] || runtime}
                </span>
              </div>
            </div>
          </div>

          {/* Stack Assignments Overview */}
          {groupStackAssignments.length > 0 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Stack-Zuweisungen</CardTitle>
              </CardHeader>
              <CardContent>
                {groupStackAssignments.map((stack) => (
                  <div key={stack.stackId} className="mb-3 last:mb-0">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">
                        {stack.stackName}
                      </span>
                      <Badge variant="outline">
                        {stack.assignedGroups.length} Gruppe(n)
                      </Badge>
                    </div>
                    {stack.assignedGroups.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {stack.assignedGroups.map((group) => (
                          <div
                            key={group.groupId}
                            className="text-xs text-slate-600 ml-2"
                          >
                            • {group.groupName}: {group.students.length}{" "}
                            Student(en)
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Configuration Parameters */}
          {Object.keys(formValues).length > 0 && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Konfiguration</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(formValues).map(([key, value]) => {
                  const param = templateVersionData?.parameters?.find(
                    (p: TemplateParameter) => p.name === key,
                  );
                  return (
                    <div key={key} className="flex justify-between py-1">
                      <span className="text-sm text-slate-600">
                        {param?.label || key}:
                      </span>
                      <span className="text-sm text-slate-900">
                        {typeof value === "boolean"
                          ? value
                            ? "Ja"
                            : "Nein"
                          : value || "-"}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-sm text-amber-900">Bereit zum Deployen</p>
                <p className="text-xs text-amber-700 mt-1">
                  Das Deployment dauert etwa 5-10 Minuten. Sie werden
                  benachrichtigt, wenn es bereit ist.
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Parameter configuration steps
    const stepParams = parametersByStep[currentStepData.stepKey] || [];

    if (stepParams.length === 0) {
      return (
        <div className="text-center py-8 text-slate-500">
          Keine Parameter für diesen Schritt verfügbar.
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {stepParams.map((param) => renderParameterField(param))}
      </div>
    );
  };

  if (error && !loading.template && !loading.groups) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-900 font-medium mb-2">Fehler beim Laden</p>
          <p className="text-slate-600 mb-4">{error}</p>
          <Button onClick={() => window.location.reload()}>Neu laden</Button>
        </div>
      </div>
    );
  }

  if (loading.template || loading.groups) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Lade Template...</p>
        </div>
      </div>
    );
  }

  const nextButtonLabel = (() => {
    if (currentStep === 0) return "Detaillierte Konfiguration";
    if (currentStep === steps.length - 2) return "Zur Übersicht";
    return "Weiter";
  })();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Progress Steps */}
      <div className="flex items-start">
        <div className="flex items-center flex-1">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            const canNavigate = index <= currentStep || isStep0ValidPure();

            return (
              <div
                key={step.stepKey}
                className={`flex items-center flex-1 ${canNavigate ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (canNavigate) setCurrentStep(index);
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && canNavigate) {
                    setCurrentStep(index);
                  }
                }}
              >
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? "bg-teal-500 text-white"
                        : isActive
                          ? "bg-teal-100 text-teal-600 border-2 border-teal-500"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-6 h-6" />
                    ) : (
                      <StepIcon className="w-6 h-6" />
                    )}
                  </div>
                  <p
                    className={`text-xs mt-2 text-center ${
                      isActive
                        ? "text-teal-600 font-medium"
                        : isCompleted
                          ? "text-slate-600"
                          : "text-slate-400"
                    }`}
                  >
                    {step.name}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 -mt-6 ${isCompleted ? "bg-teal-500" : "bg-slate-200"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>{steps[currentStep]?.name}</CardTitle>
          <CardDescription>{steps[currentStep]?.description}</CardDescription>
        </CardHeader>
        <CardContent>{renderStepContent()}</CardContent>
      </Card>

      {/* Validation Errors - only shown on step 0 */}
      {currentStep === 0 && validationErrors.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-900 mb-2">Vor dem Weiter müssen folgende Probleme behoben werden:</h4>
          <ul className="space-y-1">
            {validationErrors.map((error, idx) => (
              <li key={idx} className="text-sm text-red-800 flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={currentStep === 0 ? onCancel : handlePrevious}
          disabled={isDeploying}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          {currentStep === 0 ? "Abbrechen" : "Zurück"}
        </Button>

        <div className="flex gap-2">
          {/* Detaillierte Konfiguration (only on first step) — outline styling */}
          {currentStep === 0 && steps.length > 1 && (
            <Button
              variant="outline"
              onClick={handleNext}
              disabled={isDeploying || validationErrors.length > 0}
              className="border-teal-500 text-teal-600 hover:bg-teal-50"
            >
              Detaillierte Konfiguration
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {/* Direkt zur Übersicht (only on first step) — primary styling */}
          {currentStep === 0 && steps.length > 1 && (
            <Button
              onClick={handleSkipToOverview}
              disabled={
                !selectedVersionId ||
                !selectedKeycloakGroupId ||
                !deploymentName ||
                isDeploying
              }
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              Direkt zur Übersicht
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {currentStep > 0 && currentStep < steps.length - 1 && (
            <Button
              onClick={handleNext}
              className="bg-teal-500 hover:bg-teal-600 text-white"
              disabled={isDeploying || validationErrors.length > 0}
            >
              {nextButtonLabel}
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {currentStep === steps.length - 1 && (
            <Button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              {isDeploying ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Wird deployed...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Anwendung deployen
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
