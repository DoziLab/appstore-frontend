import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
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
      if (backendDeployment.course?.name) {
        resolvedCourseName = backendDeployment.course.name;
      } else if (backendDeployment.course_id) {
        const course = coursesCacheRef.current.find(
          (c) => c.id === backendDeployment.course_id
        );
        if (course) {
          const group = groupsCacheRef.current.find(
            (g) => g.id === (course as any).keycloak_course_id
          );
          resolvedCourseName = group?.name || course.name || resolvedCourseName;
        }
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
      getMyCourses({ page: 1, page_size: 100 }).catch(() => ({ data: [] as CourseDto[] })),
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
    />
  );
}
