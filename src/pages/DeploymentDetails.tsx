import { useCallback, useState } from "react";
import React from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Copy,
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
  type RuntimeMonths,
} from "../api/deployments";
import { type LogPhase, type PhaseStatus } from "./DeploymentDetailsPage";
import { getExpiryState } from "../utils/deployment";
import { useActiveOpenstackProject } from "../contexts/OpenstackProjectContext";

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
  // Lifecycle (B6) — null for legacy deployments without expiry tracking.
  // Both passed through from the backend, used by the expiry banner.
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
}

export function DeploymentDetails({ deployment, onBack, onDelete }: DeploymentDetailsProps) {
  const { activeProjectId } = useActiveOpenstackProject();
  const [credentialsVisible, setCredentialsVisible] = useState(false);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [credentialsData, setCredentialsData] = useState<DeploymentCredentialsResponse | null>(null);
  const [passwordVisibility, setPasswordVisibility] = useState<Record<string, boolean>>({});
  // Inline extend-action state (B6). Pessimistic: button disabled while
  // request flies, error shown via toast, success refreshes the page so the
  // new expires_at lands in `deployment` via the parent's data loader.
  const [extendInFlight, setExtendInFlight] = useState(false);
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedExtendMonths, setSelectedExtendMonths] = useState<RuntimeMonths | null>(null);

  const expiryState = getExpiryState(deployment);

  const handleConfirmExtend = useCallback(async () => {
    if (!selectedExtendMonths || extendInFlight) return;
    setExtendInFlight(true);
    try {
      await extendDeployment(deployment.id, selectedExtendMonths, activeProjectId);
      toast.success(`Deployment um ${selectedExtendMonths} Monat${selectedExtendMonths > 1 ? 'e' : ''} verlängert.`);
      setExtendDialogOpen(false);
      setSelectedExtendMonths(null);
      // Cheapest correct refresh — the parent route reloads the deployment
      // on mount, so we don't need a callback prop just for this case.
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

  // Calculate available months based on expires_at and today
  const getAvailableExtendMonths = useCallback(() => {
    if (!deployment.expires_at) return [1, 3, 4, 6, 12, 24];
    
    const today = new Date();
    const expiresDate = new Date(deployment.expires_at);
    
    // Calculate months between today and expires_at
    const monthsDiff = 
      (expiresDate.getFullYear() - today.getFullYear()) * 12 + 
      (expiresDate.getMonth() - today.getMonth());
    
    // Max extension is 24 months from today
    const maxExtension = 24 - Math.max(0, monthsDiff);
    
    // Return only the months that don't exceed 24 months total
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
    setPasswordVisibility((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getMaskedPassword = (value: string | null) => {
    if (!value) return "-";
    return "*".repeat(Math.max(8, value.length));
  };

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
            return [
              title,
              `Username: ${access.username ?? "-"}`,
              `Password: ${access.password ?? "-"}`,
              `Connection URL: ${access.connection_url ?? "-"}`,
              `Port: ${access.port ?? "-"}`,
              "",
            ].join("\n");
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

  return (
    <div className="p-8 space-y-8">
      {/* Header with Back Button */}
      <div>
        <Button
          variant="ghost"
          onClick={onBack}
          className="mb-4 -ml-2"
        >
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

            {/* Extend Deployment Dialog */}
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
                    <AlertDialogCancel disabled={extendInFlight}>
                      Abbrechen
                    </AlertDialogCancel>
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

      {/* Expiry banner (B6) — only shows when expires_at is set AND we're past
          the warning threshold or already expired. Legacy deployments without
          expiry tracking stay invisible here. */}
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
                <h3
                  className={
                    expiryState === "expired" ? "text-red-900 mb-2" : "text-amber-900 mb-2"
                  }
                >
                  {expiryState === "expired"
                    ? "Dieses Deployment ist abgelaufen und wird in Kürze gelöscht."
                    : `Läuft am ${new Date(deployment.expires_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })} ab`}
                </h3>
                <p
                  className={
                    expiryState === "expired"
                      ? "text-sm text-red-700 mb-3"
                      : "text-sm text-amber-700 mb-3"
                  }
                >
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

      {/* Progress Overview für aktive Deployments */}
      {deployment.status === 'deploying' && (
        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-slate-900 mb-1">Deployment-Fortschritt</p>
                <p className="text-sm text-slate-600">
                  {deployment.currentStep}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl text-blue-600 mb-1">{deployment.progress}%</p>
              </div>
            </div>
            <Progress value={deployment.progress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {/* Success Message für abgeschlossene Deployments */}
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

      {/* Partial failure: Heat OK but a phase failed — show as full error */}
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

      {/* Error Message für fehlgeschlagene Deployments */}
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

      {/* Cancelled Message */}
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

      {/* Delete failed — show retry */}
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
                  onClick={() => onDelete?.(deployment.id)}
                >
                  Erneut versuchen
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deleting Message */}
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
            {/* Overall progress bar */}
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

        {/* Sidebar Info */}
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
                <>
                  <Button variant="outline" className="w-full opacity-50 cursor-not-allowed" disabled>
                    VM starten
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50">
                        Deployment löschen
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-white w-auto max-w-sm sm:max-w-md max-h-[70vh] overflow-y-auto">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-red-600" />
                          Deployment löschen?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Diese Aktion kann nicht rückgängig gemacht werden. Das Deployment und alle zugehörigen Ressourcen werden entfernt.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="justify-center sm:justify-center">
                        <AlertDialogCancel className="sm:w-auto">Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                          className="sm:w-auto border bg-white border-slate-200 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => onDelete?.(deployment.id)}
                        >
                          Löschen bestätigen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
              {deployment.status === 'deploying' && (
                <Button variant="outline" className="w-full text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                  Deployment abbrechen
                </Button>
              )}
              {(deployment.status === 'failed' || deployment.status === 'cancelled') && (
                <>
                  <Button className="w-full bg-slate-200 text-slate-500 cursor-not-allowed" disabled>
                    Erneut versuchen
                  </Button>
                  <Button variant="outline" className="w-full">
                    Logs anzeigen
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <CardTitle>Credentials</CardTitle>
                <CardDescription>
                  Hier können Sie sich die Credentials anzeigen lassen.
                </CardDescription>
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

              {!credentialsLoading && !credentialsError && credentialsData && (
                <div className="space-y-6">
                  {credentialsData.instances.map((instance) => (
                    <Card key={instance.instance_id} className="border-slate-200">
                      <CardHeader>
                        <CardTitle className="text-base">
                          {instance.vm_name || "VM"}
                        </CardTitle>
                        <CardDescription>
                          Stack ID: {instance.openstack_stack_id || "-"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {instance.accesses.map((access, index) => {
                          const accessKey = `${instance.instance_id}-${access.access_type}-${index}`;
                          const isVisible = passwordVisibility[accessKey] === true;

                          return (
                            <div key={accessKey} className="rounded-lg border border-slate-200 p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-slate-900">
                                  {accessTypeLabels[access.access_type] || access.access_type}
                                </h4>
                                <Badge variant="outline">{access.access_type}</Badge>
                              </div>

                              <div className="grid gap-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs text-slate-500">Username</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-900">
                                      {access.username ?? "-"}
                                    </span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopy(access.username, "Username")}
                                      disabled={!access.username}
                                    >
                                      <Copy className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs text-slate-500">Password</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-900">
                                      {isVisible ? access.password ?? "-" : getMaskedPassword(access.password)}
                                    </span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => togglePasswordVisibility(accessKey)}
                                      disabled={!access.password}
                                    >
                                      {isVisible ? (
                                        <EyeOff className="w-4 h-4" />
                                      ) : (
                                        <Eye className="w-4 h-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopy(access.password, "Password")}
                                      disabled={!access.password}
                                    >
                                      <Copy className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs text-slate-500">
                                    {access.access_type === "ssh" ? "SSH-Befehl" : access.access_type === "web_url" ? "URL" : "Connection URL"}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {access.connection_url ? (
                                      access.access_type === "web_url" ? (
                                        <a
                                          href={access.connection_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm text-blue-600 hover:underline break-all"
                                        >
                                          {access.connection_url}
                                        </a>
                                      ) : (
                                        <code className="text-sm bg-slate-100 px-2 py-0.5 rounded break-all font-mono">
                                          {access.connection_url}
                                        </code>
                                      )
                                    ) : (
                                      <span className="text-sm text-slate-400">-</span>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopy(access.connection_url, access.access_type === "ssh" ? "SSH-Befehl" : "URL")}
                                      disabled={!access.connection_url}
                                    >
                                      <Copy className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-xs text-slate-500">Port</span>
                                  <span className="text-sm text-slate-900">
                                    {access.port ?? "-"}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
    </div>
  );
}

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

  const levelColor =
    lvl === "ERROR"   ? "#f87171" :
    lvl === "WARNING" ? "#facc15" :
    lvl === "DEBUG"   ? "#64748b" :
    "#4ade80";

  const msgColor =
    lvl === "ERROR"   ? "#fca5a5" :
    lvl === "WARNING" ? "#fde047" :
    lvl === "DEBUG"   ? "#64748b" :
    "#e2e8f0";

  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize: "12px",
        borderBottom: "1px solid #1e293b",
        cursor: hasDetails ? "pointer" : "default",
        backgroundColor: "transparent",
      }}
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

  const phaseIcon = PHASE_ICONS[phase.id] ?? <CheckCircle2 className="w-4 h-4" />;

  const dotClass =
    phase.status === "completed"
      ? "bg-green-500"
      : phase.status === "running"
      ? "bg-teal-500 animate-pulse"
      : phase.status === "failed"
      ? "bg-red-500"
      : "bg-slate-300";

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      {/* Phase header */}
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
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
      </button>

      {/* Log entries */}
      {open && (
        <div
          style={{
            borderTop: "1px solid #1e293b",
            backgroundColor: "#0f172a",
            maxHeight: "20rem",
            overflowY: "auto",
            overscrollBehavior: "contain",
          }}
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
    return (
      <p className="text-sm text-slate-400 text-center py-8">
        Noch keine Logs vorhanden.
      </p>
    );
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
