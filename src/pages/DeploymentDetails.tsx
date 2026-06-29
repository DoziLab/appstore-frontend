import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ArrowLeft,
  Download,
  Loader2,
  ChevronDown,
  ChevronRight,
  Flame,
  Terminal,
  Flag,
  AlertTriangle,
  AlertOctagon,
  Calendar,
} from "lucide-react";
import { toast } from "sonner@2.0.3";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  AccessType,
  DeploymentCredentialsResponse,
  DeploymentLogDto,
  getDeploymentCredentials,
  extendDeployment,
  downloadSshKey,
  type RuntimeMonths,
} from "../api/deployments";
import { type LogPhase, type PhaseStatus } from "./DeploymentDetailsPage";
import { getExpiryState } from "../utils/deployment";
import { useActiveOpenstackProject } from "../contexts/OpenstackProjectContext";
import { CredentialInstanceCard } from "../components/credentials/CredentialInstanceCard";
import keycloak from "../auth/keycloak";

interface DeploymentStep {
  id: string;
  name: string;
  status: 'completed' | 'in-progress' | 'pending' | 'failed';
  startTime?: string;
  endTime?: string;
  duration?: string;
  description: string;
  icon: any;
}

interface Deployment {
  id: string;
  name: string;
  status: 'deploying' | 'running' | 'failed' | 'cancelled' | 'stopped' | 'deleting' | 'delete_failed';
  /**
   * Raw backend status (lower-case). Populated by DeploymentDetailsPage from
   * `DeploymentDto.status`. Drives the action button label / confirmation
   * text — `status` alone collapses `queued` and `creating` into `deploying`,
   * which we need to distinguish for the "Abbrechen" copy.
   */
  rawStatus?: string;
  course: string;
  startedAt: string;
  completedAt?: string;
  estimatedTimeRemaining?: string;
  progress: number;
  currentStep?: string;
  steps: DeploymentStep[];
  phases?: LogPhase[];
  logs?: DeploymentLogDto[];
  error?: string;
  expires_at?: string | null;
  expiry_warning_at?: string | null;
  resources: {
    cpu: number;
    ram: number;
    storage: number;
  };
}

interface DeploymentDetailsProps {
  deployment: Deployment;
  onBack: () => void;
  onDelete?: (deploymentId: string) => Promise<void> | void;
  /**
   * Retry handler used by the "Erneut versuchen" button shown on failed
   * deployments. Implementation lives in DeploymentDetailsPage — it deletes
   * the failed deployment and navigates the user to the wizard's overview
   * step pre-filled with the same configuration.
   */
  onRetry?: (deploymentId: string) => Promise<void> | void;
}

export function DeploymentDetails({ deployment, onBack, onDelete, onRetry }: DeploymentDetailsProps) {
  const { activeProjectId } = useActiveOpenstackProject();
  const [credentialsVisible, setCredentialsVisible] = useState(false);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [credentialsData, setCredentialsData] = useState<DeploymentCredentialsResponse | null>(null);
  const [passwordVisibility, setPasswordVisibility] = useState<Record<string, boolean>>({});
  const [extendInFlight, setExtendInFlight] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedExtendMonths, setSelectedExtendMonths] = useState<RuntimeMonths | null>(null);
  const [retryInFlight, setRetryInFlight] = useState(false);
  const [deleteInFlight, setDeleteInFlight] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // ── Status-driven delete/cancel action ────────────────────────────────────
  //
  // Backend uses ONE endpoint for cancel-build and delete-deployment; it
  // inspects the row's current status and picks the right operation itself.
  // The UI just needs to label the button and the confirmation correctly so
  // the user knows what they're about to trigger.
  //
  // Statuses outside this table render no action button at all (the spec
  // covers `stopped`, `deleting`, `delete_failed`, `cancelled` elsewhere
  // via banners/spinners — they don't need a manual delete trigger here).
  const deleteAction = (() => {
    switch (deployment.rawStatus) {
      case "queued":
      case "creating":
        return {
          label: "Abbrechen",
          confirmTitle: "Build wirklich abbrechen?",
          confirmText:
            "Aktueller Build wird gestoppt, alle bereits erstellten Ressourcen werden gelöscht.",
          confirmCta: "Ja, abbrechen",
        };
      case "running":
        return {
          label: "Löschen",
          confirmTitle: "Deployment wirklich löschen?",
          confirmText: "VMs werden heruntergefahren und alle Daten entfernt.",
          confirmCta: "Ja, löschen",
        };
      case "failed":
        return {
          label: "Aufräumen",
          confirmTitle: "Deployment aufräumen?",
          confirmText:
            "Fehlgeschlagenes Deployment und verbliebene Ressourcen werden entfernt.",
          confirmCta: "Ja, aufräumen",
        };
      default:
        return null;
    }
  })();

  const handleConfirmDelete = useCallback(async () => {
    if (!onDelete || deleteInFlight) return;
    setDeleteInFlight(true);
    try {
      await onDelete(deployment.id);
      // Page-level handler flips status to "deleting" or navigates away on
      // success, AND surfaces errors via toast. Either way the dialog should
      // close — keep the spinner running until the parent unmounts us or
      // the status changes to something without a delete action.
      setDeleteDialogOpen(false);
    } catch {
      // Page swallows errors and toasts them; re-enable the button so the
      // user can retry. (Reached only if onDelete itself rejects, which the
      // current implementation doesn't, but stay defensive.)
      setDeleteInFlight(false);
    }
  }, [onDelete, deployment.id, deleteInFlight]);

  // Once the parent flips status to `deleting`, the action button disappears
  // anyway — but keep the local flag in sync so a stale `deleteInFlight`
  // from a previous click doesn't leak across status transitions.
  const isDeleting = deployment.status === "deleting";

  const handleRetry = useCallback(async () => {
    if (retryInFlight || !onRetry) return;
    setRetryInFlight(true);
    try {
      await onRetry(deployment.id);
      // Page-level handler navigates away on success; do not reset state.
    } catch {
      // Page-level handler is responsible for the error toast — re-enable the
      // button so the user can retry the retry.
      setRetryInFlight(false);
    }
  }, [retryInFlight, onRetry, deployment.id]);

  const expiryState = getExpiryState(deployment);

  const handleConfirmExtend = useCallback(async () => {
    if (!selectedExtendMonths || extendInFlight) return;
    setExtendInFlight(true);
    try {
      await extendDeployment(deployment.id, selectedExtendMonths, activeProjectId);
      toast.success(`Deployment um ${selectedExtendMonths} Monat${selectedExtendMonths > 1 ? 'e' : ''} verlängert.`);
      setExtendDialogOpen(false);
      setSelectedExtendMonths(null);
      window.location.reload();
    } catch (err) {
      const error = err as Error & { status?: number };
      if (error.status === 403) {
        toast.error("Keine Berechtigung, dieses Deployment zu verlängern.");
      } else {
        toast.error("Verlängern fehlgeschlagen. Bitte später erneut versuchen.");
      }
      setExtendInFlight(false);
    }
  }, [deployment.id, activeProjectId, selectedExtendMonths, extendInFlight]);

  const getAvailableExtendMonths = useCallback(() => {
    if (!deployment.expires_at) return [1, 3, 4, 6, 12, 24];
    const today = new Date();
    const expiresDate = new Date(deployment.expires_at);
    const monthsDiff =
      (expiresDate.getFullYear() - today.getFullYear()) * 12 +
      (expiresDate.getMonth() - today.getMonth());
    const maxExtension = 24 - Math.max(0, monthsDiff);
    return [1, 3, 4, 6, 12, 24].filter(m => m <= maxExtension);
  }, [deployment.expires_at]);

  const accessTypeLabels: Record<AccessType, string> = {
    ssh: "SSH",
    web_url: "Web URL",
    guacamole: "Guacamole",
    rdp: "RDP",
    vnc: "VNC",
    database: "Database",
  };

  const handleCopy = useCallback(async (value: string | null, label: string) => {
    if (!value) {
      toast.error("Kein Wert zum Kopieren vorhanden.");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} kopiert.`);
    } catch {
      toast.error("Kopieren fehlgeschlagen.");
    }
  }, []);

  const togglePasswordVisibility = (key: string) => {
    setPasswordVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getMaskedPassword = (value: string | null) => {
    if (!value) return "-";
    return "*".repeat(Math.max(8, value.length));
  };

  // Username des eingeloggten Lecturers — Heuristik für „dies ist der
  // Admin-Eintrag" laut Backend-Briefing. Wenn der `username` eines Access-
  // Eintrags dem entspricht, badged die CredentialInstanceCard die Zeile als
  // Admin-Zugang. Backend liefert (noch) kein explizites `is_admin`-Flag.
  const currentUsername = useMemo<string | null>(() => {
    const t = (keycloak?.tokenParsed ?? {}) as Record<string, any>;
    const u = (t.preferred_username || "").toString().trim();
    return u || null;
  }, []);

  const handleDownloadSshKey = useCallback(
    async (accessId: string, username: string | null) => {
      try {
        await downloadSshKey(deployment.id, accessId, activeProjectId, username);
        toast.success("SSH-Key heruntergeladen.");
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 400) {
          toast.error("openstack_project_id fehlt — bitte Projekt wählen.");
        } else if (status === 401) {
          toast.error("Session abgelaufen — bitte erneut anmelden.");
        } else if (status === 403) {
          toast.error("Keine Berechtigung für diesen SSH-Key.");
        } else if (status === 404) {
          // Backend unterscheidet im 404er-Body zwischen „Deployment nicht
          // gefunden", „Access-Eintrag nicht gefunden" und „kein SSH-Key
          // hinterlegt". Wir können das hier nicht sauber auseinanderhalten,
          // also bleibt es bei einer allgemeinen Meldung. Der mit Abstand
          // häufigste Fall (alte Deployments) ist „kein Key" — die Card
          // sollte den Button gar nicht erst anzeigen, aber falls doch:
          toast.error("Für diesen Zugang ist kein SSH-Key hinterlegt.");
        } else {
          toast.error("SSH-Key-Download fehlgeschlagen.");
        }
      }
    },
    [deployment.id, activeProjectId],
  );

  const loadCredentials = useCallback(async () => {
    if (credentialsLoading) return;
    setCredentialsLoading(true);
    setCredentialsError(null);
    try {
      const response = await getDeploymentCredentials(deployment.id, activeProjectId);
      setCredentialsData(response.data);
    } catch (err) {
      const error = err as Error & { status?: number };
      if (error.status === 403) {
        setCredentialsError("Sie haben keine Berechtigung, die Deployment-Credentials anzusehen.");
      } else {
        setCredentialsError("Deployment-Credentials konnten nicht geladen werden.");
      }
    } finally {
      setCredentialsLoading(false);
    }
  }, [credentialsLoading, deployment.id, activeProjectId]);

  const handleToggleCredentials = () => {
    const nextVisible = !credentialsVisible;
    setCredentialsVisible(nextVisible);
    if (nextVisible && !credentialsData && !credentialsLoading) {
      void loadCredentials();
    }
  };

  const handleDownloadCredentials = () => {
    if (!credentialsData) return;
    const content = credentialsData.instances
      .map((instance) => {
        const header = [
          `VM: ${instance.vm_name || instance.instance_id}`,
          `Stack ID: ${instance.openstack_stack_id || "-"}`,
          "",
        ].join("\n");
        const accessBlocks = instance.accesses
          .map((access) => {
            const title = accessTypeLabels[access.access_type] || access.access_type;
            const lines: string[] = [
              title,
              `Username: ${access.username ?? "-"}`,
              `Password: ${access.password ?? "-"}`,
              `Connection URL: ${access.connection_url ?? "-"}`,
              `Port: ${access.port ?? "-"}`,
            ];
            // PEM nur einfügen, wenn vorhanden — sonst landen massenhaft
            // „SSH Private Key: -"-Zeilen im Bundle und vermitteln, dass
            // jeder Eintrag einen Key hätte, was vor dem Feature-Rollout
            // nicht stimmt.
            if (access.ssh_private_key) {
              lines.push("SSH Private Key:", access.ssh_private_key);
            }
            lines.push("");
            return lines.join("\n");
          })
          .join("\n");
        return `${header}${accessBlocks}`.trimEnd();
      })
      .join("\n\n");
    const fileNameBase = deployment.name
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    const fileName = `${fileNameBase || "deployment"}-credentials.txt`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = () => {
    const hasFailedPhase = deployment.phases?.some(p => p.status === 'failed');
    switch (deployment.status) {
      case 'running':
        if (hasFailedPhase) {
          return (
            <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
              <XCircle className="w-4 h-4 mr-2" />
              Fehlgeschlagen
            </Badge>
          );
        }
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Erfolgreich bereitgestellt
          </Badge>
        );
      case 'deploying':
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Wird bereitgestellt
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            <XCircle className="w-4 h-4 mr-2" />
            Fehlgeschlagen
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
            <AlertCircle className="w-4 h-4 mr-2" />
            Abgebrochen
          </Badge>
        );
      case 'deleting':
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Wird gelöscht…
          </Badge>
        );
      case 'delete_failed':
        return (
          <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
            <AlertCircle className="w-4 h-4 mr-2" />
            Löschen fehlgeschlagen
          </Badge>
        );
      case 'stopped':
        return (
          <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
            Gestoppt
          </Badge>
        );
    }
  };

  // Status-aware delete confirmation dialog. Single instance — opened by
  // whichever button (Actions card or "delete_failed" retry banner) sets
  // deleteDialogOpen=true.
  const renderDeleteDialog = () => {
    if (!deleteAction) return null;
    return (
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white w-auto max-w-sm sm:max-w-md max-h-[70vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              {deleteAction.confirmTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteAction.confirmText}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="justify-center sm:justify-center">
            <AlertDialogCancel className="sm:w-auto" disabled={deleteInFlight}>
              Nein, abbrechen
            </AlertDialogCancel>
            <AlertDialogAction
              className="sm:w-auto border bg-white border-slate-200 text-red-600 hover:text-red-700 hover:bg-red-50"
              disabled={deleteInFlight}
              onClick={(e) => {
                // Keep the dialog open while the request is in flight; we
                // close it ourselves in handleConfirmDelete on success.
                e.preventDefault();
                void handleConfirmDelete();
              }}
            >
              {deleteInFlight ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wird gelöscht...
                </>
              ) : (
                deleteAction.confirmCta
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <Button variant="ghost" onClick={onBack} className="mb-4 -ml-2">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Zurück zum Dashboard
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-slate-900 mb-2">{deployment.name}</h1>
            <p className="text-slate-600">{deployment.course}</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            {getStatusBadge()}
            <Calendar className="w-4 h-4 text-slate-400" />
            <p className="text-sm text-slate-500">
              Gestartet: {new Date(deployment.startedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
            {deployment.expires_at && (
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={extendInFlight}
                  onClick={() => setExtendDialogOpen(true)}
                >
                  Verlängern
                </Button>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm text-slate-500">
                    Ablaufdatum: {new Date(deployment.expires_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </p>
                </div>
              </div>
            )}

            {/* Extend dialog */}
            {deployment.expires_at && (
              <AlertDialog open={extendDialogOpen} onOpenChange={setExtendDialogOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Deployment verlängern</AlertDialogTitle>
                    <AlertDialogDescription>
                      Wählen Sie aus, um wie viele Monate Sie das Deployment verlängern möchten. Maximal 24 Monate ab heute.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="grid grid-cols-2 gap-2 py-4">
                    {[1, 3, 4, 6, 12, 24].map((months) => {
                      const availableMonths = getAvailableExtendMonths();
                      const isAvailable = availableMonths.includes(months);
                      return (
                        <Button
                          key={months}
                          variant={selectedExtendMonths === months ? "default" : "outline"}
                          size="sm"
                          disabled={!isAvailable}
                          onClick={() => setSelectedExtendMonths(months as RuntimeMonths)}
                        >
                          {months} Monat{months > 1 ? 'e' : ''}
                        </Button>
                      );
                    })}
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={extendInFlight}>Abbrechen</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={!selectedExtendMonths || extendInFlight}
                      onClick={handleConfirmExtend}
                    >
                      {extendInFlight ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Verlängere…
                        </>
                      ) : (
                        "Verlängern"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>

      {/* Expiry banner */}
      {expiryState !== "ok" && deployment.expires_at && (
        <Card
          className={
            expiryState === "expired"
              ? "border-red-200 shadow-sm bg-gradient-to-br from-red-50 to-white"
              : "border-amber-200 shadow-sm bg-gradient-to-br from-amber-50 to-white"
          }
        >
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  expiryState === "expired" ? "bg-red-100" : "bg-amber-100"
                }`}
              >
                {expiryState === "expired" ? (
                  <AlertOctagon className="w-6 h-6 text-red-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                )}
              </div>
              <div className="flex-1">
                <h3 className={expiryState === "expired" ? "text-red-900 mb-2" : "text-amber-900 mb-2"}>
                  {expiryState === "expired"
                    ? "Dieses Deployment ist abgelaufen und wird in Kürze gelöscht."
                    : `Läuft am ${new Date(deployment.expires_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })} ab`}
                </h3>
                <p className={expiryState === "expired" ? "text-sm text-red-700 mb-3" : "text-sm text-amber-700 mb-3"}>
                  {expiryState === "expired"
                    ? "Verlängern Sie es jetzt, falls die nächtliche Bereinigung noch nicht gelaufen ist."
                    : "Verlängern Sie es, bevor der Cleanup-Job es entfernt."}
                </p>
                <Button
                  size="sm"
                  variant={expiryState === "expired" ? "destructive" : "default"}
                  disabled={extendInFlight}
                  onClick={() => setExtendDialogOpen(true)}
                >
                  {extendInFlight ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verlängere…
                    </>
                  ) : (
                    "Verlängern"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress for active deployments */}
      {deployment.status === 'deploying' && (
        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-900 mb-1">Deployment-Fortschritt</p>
                <p className="text-sm text-slate-600">{deployment.currentStep}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl text-blue-600 mb-1">{deployment.progress}%</p>
              </div>
            </div>
            <Progress value={deployment.progress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {/* Success */}
      {deployment.status === 'running' && !deployment.phases?.some(p => p.status === 'failed') && (
        <Card className="border-green-200 shadow-sm bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-green-900 mb-2">Deployment erfolgreich abgeschlossen</h3>
                <p className="text-sm text-green-700 mb-2">
                  Ihre Anwendung wurde erfolgreich bereitgestellt und ist jetzt für Ihre Kursteilnehmer verfügbar.
                </p>
                <p className="text-sm text-green-600">
                  Abgeschlossen am: {deployment.completedAt ? new Date(deployment.completedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Partial failure */}
      {deployment.status === 'running' && deployment.phases?.some(p => p.status === 'failed') && (
        <Card className="border-red-200 shadow-sm bg-gradient-to-br from-red-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-red-900 mb-2">Deployment fehlgeschlagen</h3>
                <p className="text-sm text-red-700 mb-3">
                  Bei der Bereitstellung ist ein Fehler aufgetreten. Bitte überprüfen Sie die Details unten.
                </p>
                {deployment.error && (
                  <div className="p-3 bg-red-100 rounded-lg">
                    <p className="text-sm text-red-900">
                      <strong>Fehlermeldung:</strong> {deployment.error}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Failed */}
      {deployment.status === 'failed' && (
        <Card className="border-red-200 shadow-sm bg-gradient-to-br from-red-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-red-900 mb-2">Deployment fehlgeschlagen</h3>
                <p className="text-sm text-red-700 mb-3">
                  Bei der Bereitstellung ist ein Fehler aufgetreten. Bitte überprüfen Sie die Details unten und versuchen Sie es erneut.
                </p>
                <div className="p-3 bg-red-100 rounded-lg">
                  <p className="text-sm text-red-900">
                    <strong>Fehlermeldung:</strong> {deployment.error}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cancelled */}
      {deployment.status === 'cancelled' && (
        <Card className="border-orange-200 shadow-sm bg-gradient-to-br from-orange-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-orange-900 mb-2">Deployment abgebrochen</h3>
                <p className="text-sm text-orange-700">
                  Das Deployment wurde manuell abgebrochen. Alle teilweise erstellten Ressourcen wurden bereinigt.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete failed */}
      {deployment.status === 'delete_failed' && (
        <Card className="border-orange-200 shadow-sm bg-gradient-to-br from-orange-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-orange-900 mb-2">Löschen fehlgeschlagen</h3>
                <p className="text-sm text-orange-700 mb-3">
                  Das Deployment konnte nicht vollständig gelöscht werden. Bitte versuchen Sie es erneut.
                </p>
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={deleteInFlight || !onDelete}
                  onClick={() => void handleConfirmDelete()}
                >
                  {deleteInFlight ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Wird gelöscht...
                    </>
                  ) : (
                    "Erneut versuchen"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deleting */}
      {deployment.status === 'deleting' && (
        <Card className="border-red-200 shadow-sm bg-gradient-to-br from-red-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <Loader2 className="w-6 h-6 text-red-600 animate-spin" />
              </div>
              <div className="flex-1">
                <h3 className="text-red-900 mb-2">Deployment wird gelöscht…</h3>
                <p className="text-sm text-red-700">
                  Die Ressourcen werden gerade abgebaut. Sie werden automatisch zum Dashboard weitergeleitet.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deployment Steps */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Deployment-Schritte</CardTitle>
                <CardDescription>Detaillierter Ablauf der Bereitstellung</CardDescription>
              </div>
              {deployment.status === "deploying" && (
                <span className="flex items-center gap-1.5 text-xs text-teal-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{deployment.currentStep ?? (deployment.status === "running" ? "Abgeschlossen" : "Warte auf Start…")}</span>
                <span>{deployment.progress}%</span>
              </div>
              <Progress value={deployment.progress} className="h-2" />
            </div>
          </CardHeader>
          <CardContent>
            <DeploymentPhaseList phases={deployment.phases ?? []} isLive={deployment.status === "deploying"} />
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Resource Allocation */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Ressourcenzuteilung</CardTitle>
              <CardDescription>Zugewiesene Ressourcen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">CPU-Kerne</span>
                <Badge variant="outline">{deployment.resources.cpu} Kerne</Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">Arbeitsspeicher</span>
                <Badge variant="outline">{deployment.resources.ram} GB</Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">Speicher</span>
                <Badge variant="outline">{deployment.resources.storage} GB</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Aktionen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {deployment.status === 'running' && (
                <Button variant="outline" className="w-full opacity-50 cursor-not-allowed" disabled>
                  VM starten
                </Button>
              )}

              {/* Retry-from-failed (separate flow from the delete/cleanup action) */}
              {deployment.status === 'failed' && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={retryInFlight || !onRetry || isDeleting || deleteInFlight}
                    >
                      {retryInFlight ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Wird vorbereitet…
                        </>
                      ) : (
                        "Erneut versuchen"
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-white w-auto max-w-sm sm:max-w-md max-h-[70vh] overflow-y-auto">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-slate-600" />
                        Deployment erneut versuchen?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Dieses Deployment wird gelöscht und ihre aktuellen Einstellungen und Daten für ein erneutes Deployment übernommen.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="justify-center sm:justify-center">
                      <AlertDialogCancel className="sm:w-auto">Abbrechen</AlertDialogCancel>
                      <AlertDialogAction
                        className="sm:w-auto border bg-white border-slate-200 text-slate-900 hover:bg-slate-50"
                        onClick={handleRetry}
                      >
                        Ja, erneut versuchen
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}

              {/* Cancelled deployments may still be re-tried via the wizard */}
              {deployment.status === 'cancelled' && (
                <Button variant="outline" className="w-full">
                  Erneut versuchen
                </Button>
              )}

              {/* Unified delete/cancel/cleanup button — label and confirmation
                  text come from `deleteAction`, which switches on the raw
                  backend status (queued/creating/running/failed). For all
                  other statuses, deleteAction is null and no button renders. */}
              {deleteAction && (
                <Button
                  variant="outline"
                  className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                  disabled={isDeleting || deleteInFlight || !onDelete}
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  {isDeleting || deleteInFlight ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Wird gelöscht...
                    </>
                  ) : (
                    deleteAction.label
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
          {renderDeleteDialog()}
        </div>
      </div>

      {/* Credentials */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle>Credentials</CardTitle>
              <CardDescription>Hier können Sie sich die Credentials anzeigen lassen.</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleCredentials}
                disabled={credentialsLoading}
              >
                {credentialsLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2" />
                    Laden...
                  </>
                ) : credentialsVisible ? (
                  "Verbergen"
                ) : (
                  "Credentials anzeigen"
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadCredentials}
                disabled={!credentialsData || credentialsLoading}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </CardHeader>
        {credentialsVisible && (
          <CardContent className="space-y-6">
            {credentialsLoading && (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Credentials werden geladen...</span>
              </div>
            )}

            {!credentialsLoading && credentialsError && (
              <div className="space-y-3">
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-sm text-red-700">{credentialsError}</span>
                </div>
                <Button variant="outline" size="sm" onClick={loadCredentials}>
                  Erneut versuchen
                </Button>
              </div>
            )}

              {!credentialsLoading && credentialsError && (
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <span className="text-sm text-red-700">{credentialsError}</span>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadCredentials}>
                    Erneut versuchen
                  </Button>
                </div>
              )}

              {!credentialsLoading && !credentialsError && credentialsData && (
                <div className="space-y-6">
                  {credentialsData.instances.map((instance) => (
                    <CredentialInstanceCard
                      key={instance.instance_id}
                      instance={instance}
                      mode="lecturer"
                      passwordVisibility={passwordVisibility}
                      togglePasswordVisibility={togglePasswordVisibility}
                      handleCopy={handleCopy}
                      getMaskedPassword={getMaskedPassword}
                      onDownloadSshKey={handleDownloadSshKey}
                      currentUsername={currentUsername}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
    </div>
  );
}

// ── Credentials helpers ───────────────────────────────────────────────────────
// CredentialInstanceCard + AccessRow leben jetzt in
// components/credentials/CredentialInstanceCard.tsx — geteilt mit dem
// Student-View (mode="student"). Hier nur noch der mode="lecturer"-Caller.


// ── Phase helpers ─────────────────────────────────────────────────────────────

const PHASE_ICONS: Record<string, React.ReactNode> = {
  heat: <Flame className="w-4 h-4" />,
  ansible: <Terminal className="w-4 h-4" />,
  done: <Flag className="w-4 h-4" />,
};

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return iso;
  }
}

function phaseBadge(status: PhaseStatus) {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-100 text-green-800 border-green-200">Fertig</Badge>;
    case "running":
      return <Badge className="bg-teal-100 text-teal-800 border-teal-200">Läuft</Badge>;
    case "failed":
      return <Badge className="bg-red-100 text-red-800 border-red-200">Fehler</Badge>;
    default:
      return <Badge variant="outline" className="text-slate-400">Ausstehend</Badge>;
  }
}

function LogRow({ log }: { log: DeploymentLogDto }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails = log.details && Object.keys(log.details).length > 0;
  const lvl = log.level.toUpperCase();
  const levelColor = lvl === "ERROR" ? "#f87171" : lvl === "WARNING" ? "#facc15" : lvl === "DEBUG" ? "#64748b" : "#4ade80";
  const msgColor = lvl === "ERROR" ? "#fca5a5" : lvl === "WARNING" ? "#fde047" : lvl === "DEBUG" ? "#64748b" : "#e2e8f0";

  return (
    <div
      style={{ fontFamily: "monospace", fontSize: "12px", borderBottom: "1px solid #1e293b", cursor: hasDetails ? "pointer" : "default", backgroundColor: "transparent" }}
      onMouseEnter={e => { if (hasDetails) (e.currentTarget as HTMLElement).style.backgroundColor = "#1e293b"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
      onClick={() => hasDetails && setExpanded(e => !e)}
    >
      <div style={{ display: "grid", gridTemplateColumns: "16px 72px 72px 1fr", gap: "8px", padding: "6px 16px", alignItems: "baseline" }}>
        <span style={{ color: "#94a3b8" }}>{hasDetails ? (expanded ? "▾" : "▸") : ""}</span>
        <span style={{ color: "#94a3b8" }}>{fmtTime(log.created_at)}</span>
        <span style={{ color: levelColor, fontWeight: "bold" }}>[{log.level.toLowerCase()}]</span>
        <span style={{ color: msgColor, wordBreak: "break-word" }}>{log.message}</span>
      </div>
      {expanded && hasDetails && (
        <pre style={{ margin: "0 16px 8px 40px", color: "#94a3b8", whiteSpace: "pre-wrap", wordBreak: "break-all", fontSize: "11px" }}>
          {JSON.stringify(log.details, null, 2)}
        </pre>
      )}
    </div>
  );
}

function PhaseRow({ phase, isLive, defaultOpen }: { phase: LogPhase; isLive: boolean; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  // Auto-scroll: keep the log container pinned to the bottom as new entries
  // stream in, but only while the user hasn't manually scrolled up. If they
  // scroll away from the bottom we pause auto-scroll until they return — this
  // is the standard terminal-tail behavior (tail -f, browser DevTools console).
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = logContainerRef.current;
    if (!el) return;
    // Consider "at the bottom" within a 32px slack so the last partial line
    // doesn't accidentally disengage auto-scroll.
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 32;
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = logContainerRef.current;
    if (!el) return;
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [phase.logs.length, phase.status, open]);

  const phaseIcon = PHASE_ICONS[phase.id] ?? <CheckCircle2 className="w-4 h-4" />;
  const dotClass =
    phase.status === "completed" ? "bg-green-500" :
    phase.status === "running" ? "bg-teal-500 animate-pulse" :
    phase.status === "failed" ? "bg-red-500" :
    "bg-slate-300";

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`} />
        <span className="text-slate-500 flex-shrink-0">{phaseIcon}</span>
        <span className="flex-1 font-medium text-slate-900 text-sm">{phase.label}</span>
        {phase.logs.length > 0 && (
          <span className="text-xs text-slate-400 mr-2">{phase.logs.length} Einträge</span>
        )}
        {phaseBadge(phase.status)}
        {open ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {open && (
        <div
          ref={logContainerRef}
          onScroll={handleScroll}
          style={{ borderTop: "1px solid #1e293b", backgroundColor: "#0f172a", maxHeight: "400px", overflowY: "auto" }}
        >
          {phase.logs.length === 0 ? (
            <p className="px-4 py-3 text-xs italic font-mono" style={{ color: "#475569" }}>
              {phase.status === "pending" ? "// Noch nicht gestartet" : "// Keine Einträge"}
            </p>
          ) : (
            phase.logs.map((log) => <LogRow key={log.id} log={log} />)
          )}
          {phase.status === "running" && isLive && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs font-mono" style={{ color: "#2dd4bf" }}>
              <Loader2 className="w-3 h-3 animate-spin" />
              warte auf neue logs…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeploymentPhaseList({ phases, isLive }: { phases: LogPhase[]; isLive: boolean }) {
  if (phases.length === 0) {
    return <p className="text-sm text-slate-400 text-center py-8">Noch keine Logs vorhanden.</p>;
  }
  return (
    <div className="space-y-3">
      {phases.map((phase) => (
        <PhaseRow
          key={phase.id}
          phase={phase}
          isLive={isLive}
          defaultOpen={phase.status === "running" || phase.status === "failed"}
        />
      ))}
    </div>
  );
}
