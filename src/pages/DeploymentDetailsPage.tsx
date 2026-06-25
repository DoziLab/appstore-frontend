import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { toast } from "sonner@2.0.3";
import { DeploymentDetails } from "./DeploymentDetails";
import {
  getDeployment,
  getDeploymentLogs,
  streamDeploymentLogs,
  deleteDeployment,
  type DeploymentLogDto,
} from "../api/deployments";
import { getMyCourses, type CourseDto } from "../api/courses";
import { getKeycloakGroups, type KeycloakGroup } from "../api/keycloak";
import { getFlavors, type FlavorDto } from "../api/openstack";
import { useActiveOpenstackProject } from "../contexts/OpenstackProjectContext";
import type { DeploymentWizardInitialState } from "./DeploymentWizard";
import type { StudentGroup } from "../components/GroupManager";

// ── Phase definitions ─────────────────────────────────────────────────────────

export type PhaseStatus = "pending" | "running" | "completed" | "failed";

export interface LogPhase {
  id: string;        // e.g. "heat", "ansible", "done"
  label: string;
  status: PhaseStatus;
  logs: DeploymentLogDto[];
  startedAt?: string;
  finishedAt?: string;
}

const HEAT_EVENTS = new Set([
  "DEPLOYMENT_STARTED",
  "STACK_CREATE",
  "SSH_WAIT",
  "VM_READY",
]);

const ANSIBLE_EVENTS = new Set([
  "ANSIBLE_STARTED",
  "ANSIBLE_TASK",
  "ANSIBLE_OK",
  "ANSIBLE_FAILED",
  "ANSIBLE_COMPLETED",
]);

function buildPhases(logs: DeploymentLogDto[]): LogPhase[] {
  const heat: DeploymentLogDto[] = [];
  const ansible: DeploymentLogDto[] = [];
  const done: DeploymentLogDto[] = [];

  let ansibleStarted = false;

  for (const log of logs) {
    const et = log.event_type.toUpperCase();
    if (ANSIBLE_EVENTS.has(et)) {
      ansibleStarted = true;
      ansible.push(log);
    } else if (et === "DEPLOYMENT_DELETED" || et === "DEPLOYMENT_DELETION_REQUESTED") {
      done.push(log);
    } else if (et === "FAILED" && ansibleStarted) {
      // FAILED after Ansible started belongs to Ansible phase
      ansible.push(log);
    } else {
      heat.push(log);
    }
  }

  // Heat is complete when VM_READY appears (regardless of Ansible outcome)
  const vmReady = heat.some((l) => l.event_type.toUpperCase() === "VM_READY");
  // Heat failed only if a FAILED/ERROR log exists and no stacks were created
  const heatError = heat.some(
    (l) => (l.event_type.toUpperCase() === "FAILED" || l.level === "ERROR") && !vmReady
  );

  let heatStatus: PhaseStatus = "pending";
  if (heat.length === 0) heatStatus = "pending";
  else if (heatError) heatStatus = "failed";
  else if (vmReady || ansible.length > 0) heatStatus = "completed";
  else heatStatus = "running";

  // Ansible status
  const ansibleFailed = ansible.some(
    (l) => l.event_type.toUpperCase() === "ANSIBLE_FAILED" || l.level === "ERROR"
  );
  const ansibleCompleted = ansible.some(
    (l) => l.event_type.toUpperCase() === "ANSIBLE_COMPLETED"
  );

  let ansibleStatus: PhaseStatus = "pending";
  if (ansible.length === 0) {
    ansibleStatus = heatStatus === "completed" ? "running" : "pending";
  } else if (ansibleFailed) {
    ansibleStatus = "failed";
  } else if (ansibleCompleted) {
    ansibleStatus = "completed";
  } else {
    ansibleStatus = "running";
  }

  const doneStatus: PhaseStatus = done.length > 0 ? "completed" : "pending";

  const ts = (arr: DeploymentLogDto[]) => arr[0]?.created_at;
  const te = (arr: DeploymentLogDto[]) => arr[arr.length - 1]?.created_at;

  return [
    {
      id: "heat",
      label: "Infrastruktur (Heat)",
      status: heatStatus,
      logs: heat,
      startedAt: ts(heat),
      finishedAt: heatStatus === "completed" || heatStatus === "failed" ? te(heat) : undefined,
    },
    {
      id: "ansible",
      label: "Konfiguration (Ansible)",
      status: ansibleStatus,
      logs: ansible,
      startedAt: ts(ansible),
      finishedAt: ansibleStatus === "completed" || ansibleStatus === "failed" ? te(ansible) : undefined,
    },
    ...(done.length > 0 ? [{
      id: "done",
      label: "Abgeschlossen",
      status: "completed" as PhaseStatus,
      logs: done,
      startedAt: ts(done),
    }] : []),
  ];
}

function calcProgress(phases: LogPhase[], overallStatus: string): number {
  if (overallStatus === "running") return 100;
  if (overallStatus === "failed") {
    const completedCount = phases.filter((p) => p.status === "completed").length;
    return Math.round((completedCount / phases.length) * 100);
  }
  const weights = [40, 60]; // heat, ansible
  let progress = 0;
  phases.forEach((phase, i) => {
    if (phase.status === "completed") progress += weights[i];
    else if (phase.status === "running") {
      // partial credit based on log count within this phase
      const phaseLogs = phase.logs.length;
      progress += Math.min(weights[i] * 0.6, weights[i] * (phaseLogs / 10));
    }
  });
  return Math.min(99, Math.round(progress));
}

// ── Status mapping ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, "deploying" | "running" | "failed" | "cancelled" | "stopped" | "deleting"> = {
  QUEUED: "deploying",
  CREATING: "deploying",
  PROCESSING: "deploying",
  DEPLOYING: "deploying",
  ACTIVE: "running",
  RUNNING: "running",
  CREATE_COMPLETE: "running",
  FAILED: "failed",
  CREATE_FAILED: "failed",
  DELETE_COMPLETE: "stopped",
  DELETING: "deleting",
  CANCELLED: "cancelled",
  DELETED: "stopped",
};

const ACTIVE_STATUSES = new Set(["deploying"]);

// ── Component ─────────────────────────────────────────────────────────────────

export function DeploymentDetailsPage() {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const navigate = useNavigate();
  const { activeProjectId } = useActiveOpenstackProject();
  const [deploymentData, setDeploymentData] = useState<any>(null);
  const [loadingDeployment, setLoadingDeployment] = useState(false);
  const isDeletingRef = useRef(false);

  // Stable reference data fetched once
  const coursesCacheRef = useRef<CourseDto[]>([]);
  const groupsCacheRef = useRef<KeycloakGroup[]>([]);
  // Nova flavor catalog keyed by name. Loaded once at mount; used to turn
  // each instance's `flavor` string into real vCPU/RAM/disk for the resource
  // block. Empty Map until the request resolves — instances with unknown
  // flavors fall back to '—' rather than a hardcoded multiplier.
  const flavorsByNameRef = useRef<Map<string, FlavorDto>>(new Map());
  // Accumulate logs from SSE
  const logsRef = useRef<DeploymentLogDto[]>([]);
  const backendDeploymentRef = useRef<any>(null);
  const stopStreamRef = useRef<(() => void) | null>(null);

  const handleBackToDashboard = () => navigate("/dashboard");

  // ── Retry flow for failed deployments ─────────────────────────────────────
  //
  // Delete the failed deployment, then jump the user to the wizard's overview
  // step with the exact same configuration pre-filled. Reconstructs the
  // wizard initial-state payload from `deployment_parameters` JSON (Heat
  // params, stack assignments) plus a few related-object fields the backend
  // returns alongside (template_version.template_id, expires_at for runtime).
  //
  // No confirmation dialog — the trigger button is explicit and the data is
  // recoverable until the user re-submits the wizard.
  const handleRetryDeployment = useCallback(
    async (id: string) => {
      const raw = backendDeploymentRef.current;
      if (!raw) {
        toast.error("Deployment-Daten nicht geladen. Bitte Seite neu laden.");
        throw new Error("deployment data missing");
      }

      const templateId: string | undefined = raw?.template_version?.template_id;
      if (!templateId) {
        toast.error("Template konnte nicht ermittelt werden.");
        throw new Error("template_id missing");
      }

      // Resolve the Keycloak group ID. The backend stores `course_id` as the
      // *DB* course UUID (see deployment_service.create_deployment), NOT the
      // Keycloak group ID — passing it to the wizard verbatim makes the
      // members fetch 404 with "Could not find group by id". Look up the
      // course in the cache and grab its `keycloak_course_id`.
      const dbCourseId: string | undefined = raw.course_id;
      const course = dbCourseId
        ? coursesCacheRef.current.find((c) => c.id === dbCourseId)
        : undefined;
      const keycloakGroupId = course?.keycloak_course_id;
      if (!keycloakGroupId) {
        toast.error("Kurs konnte nicht aufgelöst werden. Bitte Seite neu laden.");
        throw new Error("keycloak_course_id missing");
      }

      // 1. DELETE without confirmation.
      try {
        await deleteDeployment(id, activeProjectId);
      } catch (err) {
        console.error("Retry: failed to delete deployment", err);
        toast.error("Löschen fehlgeschlagen. Bitte erneut versuchen.");
        throw err;
      }

      // 2. Parse `deployment_parameters` (JSON string) into the wizard's
      //    initial-state shape. Defensive against legacy rows that lack the
      //    stack_assignments block.
      let parsed: any = {};
      try {
        parsed = raw.deployment_parameters
          ? JSON.parse(raw.deployment_parameters)
          : {};
      } catch {
        parsed = {};
      }

      const storedStackAssignments: Array<{
        groups: Array<{
          group_name: string;
          group_index: number;
          students: Array<{
            id: string;
            username: string;
            email: string;
            first_name: string;
            last_name: string;
          }>;
        }>;
      }> = parsed.stack_assignments ?? [];

      // Hydrate StudentGroup[] from the union of all groups across stacks.
      // group_index doubles as a stable identifier; map snake_case student
      // fields back to KeycloakUser's camelCase shape. `enabled`/`emailVerified`
      // aren't stored — assume true (the user already passed deployment).
      const seenGroupIds = new Set<string>();
      const studentGroups: StudentGroup[] = [];
      const groupStackAssignments = storedStackAssignments.map((sa, stackIdx) => {
        const assignedGroups: StudentGroup[] = sa.groups.map((g) => {
          const groupId = `group-${g.group_index}`;
          const group: StudentGroup = {
            groupId,
            groupName: g.group_name,
            students: (g.students || []).map((s) => ({
              id: s.id,
              username: s.username,
              email: s.email,
              firstName: s.first_name,
              lastName: s.last_name,
              enabled: true,
              emailVerified: true,
            })),
          };
          if (!seenGroupIds.has(groupId)) {
            seenGroupIds.add(groupId);
            studentGroups.push(group);
          }
          return group;
        });
        return {
          stackId: `stack-${stackIdx + 1}`,
          stackName: `Stack ${stackIdx + 1}`,
          assignedGroups,
        };
      });

      // Derive runtime_months from the persisted lifecycle window — backend
      // doesn't store the original choice on the row, only the resulting
      // expires_at. We round to the nearest allowed value so the wizard's
      // <Select> can show it without the user reseating the field.
      const ALLOWED: Array<1 | 3 | 4 | 6 | 12 | 24> = [1, 3, 4, 6, 12, 24];
      let runtimeMonths: number | undefined;
      if (raw.expires_at && raw.created_at) {
        const createdMs = new Date(raw.created_at).getTime();
        const expiresMs = new Date(raw.expires_at).getTime();
        if (
          Number.isFinite(createdMs) &&
          Number.isFinite(expiresMs) &&
          expiresMs > createdMs
        ) {
          const months = (expiresMs - createdMs) / (1000 * 60 * 60 * 24 * 30);
          runtimeMonths = ALLOWED.reduce((best, m) =>
            Math.abs(m - months) < Math.abs(best - months) ? m : best,
          );
        }
      }

      const initialState: DeploymentWizardInitialState = {
        deploymentName: raw.name || "",
        templateVersionId: raw.template_version_id,
        keycloakGroupId,
        runtimeMonths,
        parameters: parsed.parameters ?? {},
        studentGroups,
        groupStackAssignments,
      };

      // 3. Navigate to wizard with prefill payload. Router state survives
      //    until the user navigates away from the wizard route.
      navigate(`/deploy/${templateId}`, { state: { retryFrom: initialState } });
    },
    [activeProjectId, navigate],
  );

  const handleDeleteDeployment = async (id: string) => {
    isDeletingRef.current = true;
    stopStreamRef.current?.();
    setDeploymentData((prev: any) => prev ? { ...prev, status: "deleting" } : prev);

    try {
      await deleteDeployment(id, activeProjectId);
    } catch (err) {
      console.error("Failed to initiate delete", err);
    }

    // Poll for max 60s, then give up and show retry
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const resp = await getDeployment(id, activeProjectId);
        const s = resp.data.status.toUpperCase();
        if (s === "DELETED" || s === "DELETE_COMPLETE") {
          navigate("/dashboard");
        } else if (attempts < 30) {
          setTimeout(poll, 2000);
        } else {
          // Timeout — let user retry
          isDeletingRef.current = false;
          setDeploymentData((prev: any) => prev ? { ...prev, status: "delete_failed" } : prev);
        }
      } catch {
        navigate("/dashboard");
      }
    };
    poll();
  };

  const buildDeploymentData = useCallback(
    (backendDeployment: any, logs: DeploymentLogDto[]) => {
      const mappedStatus =
        STATUS_MAP[backendDeployment.status.toUpperCase()] || "deploying";

      const phases = buildPhases(logs);
      const progress = calcProgress(phases, mappedStatus);

      const failedLog = logs.find(
        (l) =>
          l.event_type.toLowerCase().includes("failed") ||
          l.level === "ERROR"
      );

      const steps = logs.map((log) => ({
        id: log.id,
        name: log.event_type.replace(/_/g, " "),
        status:
          log.event_type.toUpperCase().includes("FAILED") || log.level === "ERROR"
            ? ("failed" as const)
            : ("completed" as const),
        startTime: log.created_at,
        description: log.message,
        icon: null,
      }));

      let cpu = 0, ram = 0, storage = 0;
      // Sum vCPU/RAM/disk from each instance's actual Nova flavor. Instances
      // whose flavor isn't in the catalog (legacy rows with `flavor === null`,
      // private flavors not visible to the caller) are silently skipped — we
      // do NOT fall back to length*N multipliers, because that masks the gap.
      const flavorsByName = flavorsByNameRef.current;
      for (const inst of backendDeployment.instances ?? []) {
        const f = inst.flavor ? flavorsByName.get(inst.flavor) : undefined;
        if (!f) continue;
        cpu += f.vcpus;
        ram += Math.round(f.ram_mb / 1024);
        storage += f.disk_gb;
      }

      let resolvedCourseName = "Unbekannter Kurs";
      
      // Try to resolve course name from course_id first
      if (backendDeployment.course_id) {
        const course = coursesCacheRef.current.find(
          (c) => c.id === backendDeployment.course_id
        );
        if (course) {
          // If course has keycloak_course_id, try to resolve the Keycloak group name
          if ((course as any).keycloak_course_id) {
            const group = groupsCacheRef.current.find(
              (g) => g.id === (course as any).keycloak_course_id
            );
            resolvedCourseName = group?.name || course.name || resolvedCourseName;
          } else {
            // Fall back to course name
            resolvedCourseName = course.name || resolvedCourseName;
          }
        }
      }
      
      // Fall back to course.name from backend if available
      if (resolvedCourseName === "Unbekannter Kurs" && backendDeployment.course?.name) {
        resolvedCourseName = backendDeployment.course.name;
      }

      return {
        id: backendDeployment.id,
        name: backendDeployment.name || "Unnamed Deployment",
        status: mappedStatus,
        course: resolvedCourseName,
        startedAt: backendDeployment.created_at,
        completedAt:
          mappedStatus === "running" || mappedStatus === "failed"
            ? backendDeployment.updated_at
            : undefined,
        progress,
        currentStep: phases.find((p) => p.status === "running")?.label,
        steps,
        phases,
        logs,
        error: failedLog?.message || undefined,
        // Lifecycle (B6) — passed through verbatim; presentational decisions
        // (banner / icon / 'läuft ab in X Tagen') happen in DeploymentDetails.
        expires_at: backendDeployment.expires_at ?? null,
        expiry_warning_at: backendDeployment.expiry_warning_at ?? null,
        resources: { cpu, ram, storage },
      };
    },
    []
  );

  useEffect(() => {
    if (!deploymentId) return;

    setLoadingDeployment(true);
    logsRef.current = [];

    // Fetch reference data + initial deployment + existing logs in parallel.
    // Flavors are merged in even on partial failure (empty Map → fallback '—').
    Promise.all([
      getMyCourses({ page: 1, page_size: 100, openstack_project_id: activeProjectId }).catch(() => ({ data: [] as CourseDto[] })),
      getKeycloakGroups().catch(() => ({ data: [] as KeycloakGroup[] })),
      getDeployment(deploymentId, activeProjectId),
      getDeploymentLogs(deploymentId, activeProjectId).catch(() => ({ data: [] as DeploymentLogDto[] })),
      getFlavors().catch(() => ({ flavors: [] as FlavorDto[] })),
    ]).then(([coursesResp, groupsResp, depResp, logsResp, flavorsResp]) => {
      coursesCacheRef.current = (coursesResp as any)?.data || [];
      groupsCacheRef.current = (groupsResp as any)?.data || [];
      flavorsByNameRef.current = new Map(
        ((flavorsResp as any)?.flavors ?? []).map((f: FlavorDto) => [f.name, f])
      );
      backendDeploymentRef.current = depResp.data;

      const existingLogs: DeploymentLogDto[] = (logsResp as any).data || [];
      logsRef.current = existingLogs;

      setDeploymentData(buildDeploymentData(depResp.data, existingLogs));
      setLoadingDeployment(false);

      // Start SSE stream from the last known log (avoids duplicates)
      const lastLogId = existingLogs.length > 0 ? existingLogs[existingLogs.length - 1].id : undefined;
      const stopStream = streamDeploymentLogs(
        deploymentId,
        lastLogId,
        activeProjectId,
        (log) => {
          if (isDeletingRef.current) return;
          logsRef.current = [...logsRef.current, log];
          if (backendDeploymentRef.current) {
            setDeploymentData(buildDeploymentData(backendDeploymentRef.current, logsRef.current));
          }
        },
        () => {
          if (isDeletingRef.current) return;
          getDeployment(deploymentId, activeProjectId).then((depResp) => {
            backendDeploymentRef.current = depResp.data;
            setDeploymentData(buildDeploymentData(depResp.data, logsRef.current));
          }).catch(() => {});
        },
      );
      stopStreamRef.current = stopStream;
    }).catch(() => setLoadingDeployment(false));

    return () => { stopStreamRef.current?.(); stopStreamRef.current = null; };
  }, [deploymentId, activeProjectId, buildDeploymentData]);

  if (!deploymentId) return <Navigate to="/dashboard" replace />;
  if (loadingDeployment) return <div className="p-6">Lade Deployment...</div>;
  if (!deploymentData) return <div className="p-6">Deployment nicht gefunden</div>;

  return (
    <DeploymentDetails
      deployment={deploymentData}
      onBack={handleBackToDashboard}
      onDelete={handleDeleteDeployment}
      onRetry={handleRetryDeployment}
    />
  );
}
