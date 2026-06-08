import { useCallback, useState } from "react";
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
  Loader2
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
  AccessType,
  DeploymentCredentialsResponse,
  getDeploymentCredentials,
} from "../api/deployments";

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
  status: 'deploying' | 'running' | 'failed' | 'cancelled' | 'stopped';
  course: string;
  startedAt: string;
  completedAt?: string;
  estimatedTimeRemaining?: string;
  progress: number;
  currentStep?: string;
  steps: DeploymentStep[];
  error?: string;
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
  const [credentialsVisible, setCredentialsVisible] = useState(false);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [credentialsData, setCredentialsData] = useState<DeploymentCredentialsResponse | null>(null);
  const [passwordVisibility, setPasswordVisibility] = useState<Record<string, boolean>>({});

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
      const response = await getDeploymentCredentials(deployment.id);
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
  }, [credentialsLoading, deployment.id]);

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
    switch (deployment.status) {
      case 'running':
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
      case 'stopped':
        return (
          <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
            Gestoppt
          </Badge>
        );
    }
  };

  const getStepIcon = (step: DeploymentStep) => {
    const Icon = step.icon;
    
    switch (step.status) {
      case 'completed':
        return (
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
        );
      case 'in-progress':
        return (
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
          </div>
        );
      case 'failed':
        return (
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-600" />
          </div>
        );
      case 'pending':
        return (
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <Icon className="w-5 h-5 text-slate-400" />
          </div>
        );
    }
  };

  const getStepStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Abgeschlossen</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">In Bearbeitung</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Fehlgeschlagen</Badge>;
      case 'pending':
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Ausstehend</Badge>;
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
          <div className="flex flex-col items-end gap-2">
            {getStatusBadge()}
            <p className="text-sm text-slate-500">
              Gestartet: {deployment.startedAt}
            </p>
          </div>
        </div>
      </div>

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
                <p className="text-sm text-slate-500">
                  <Clock className="w-3 h-3 inline mr-1" />
                  Ca. {deployment.estimatedTimeRemaining} verbleibend
                </p>
              </div>
            </div>
            <Progress value={deployment.progress} className="h-3" />
          </CardContent>
        </Card>
      )}

      {/* Success Message für abgeschlossene Deployments */}
      {deployment.status === 'running' && (
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
                  Abgeschlossen am: {deployment.completedAt}
                </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deployment Steps */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Deployment-Schritte</CardTitle>
            <CardDescription>
              Detaillierter Ablauf der Bereitstellung
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {deployment.steps.map((step, index) => (
                <div key={step.id} className="relative">
                  {/* Connecting Line */}
                  {index < deployment.steps.length - 1 && (
                    <div 
                      className={`absolute left-5 top-10 w-0.5 h-full ${
                        step.status === 'completed' ? 'bg-green-200' : 'bg-slate-200'
                      }`}
                    />
                  )}
                  
                  <div className="flex gap-4">
                    {getStepIcon(step)}
                    
                    <div className="flex-1 pb-2">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="text-slate-900 mb-1">{step.name}</h4>
                          <p className="text-sm text-slate-600">{step.description}</p>
                        </div>
                        {getStepStatusBadge(step.status)}
                      </div>
                      
                      <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                        {step.startTime && (
                          <span>Gestartet: {step.startTime}</span>
                        )}
                        {step.endTime && (
                          <span>· Beendet: {step.endTime}</span>
                        )}
                        {step.duration && (
                          <span>· Dauer: {step.duration}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
                  <Button variant="outline" className="w-full" disabled>
                    Logs anzeigen
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
                                  <span className="text-xs text-slate-500">Connection URL</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-900 break-all">
                                      {access.connection_url ?? "-"}
                                    </span>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleCopy(access.connection_url, "Connection URL")}
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
