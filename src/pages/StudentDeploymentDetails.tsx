// Student-Detailansicht eines Deployments. Zeigt:
// - VM-Liste mit Status und IP
// - Eigene Group-Credentials (eingeschränkter mode der geteilten
//   CredentialInstanceCard — kein Dozent-Tab)
//
// Bewusst weggelassen ggü. der Lecturer-Ansicht: Logs/SSE, Extend-Button,
// Delete-Button, Retry-Wizard, Phasen-Tracker, Stats-Karten. Studenten
// dürfen das alles nicht und das Backend würde es ihnen ohnehin als 403
// liefern.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Server,
  AlertCircle,
  Calendar,
} from "lucide-react";
import { toast } from "sonner@2.0.3";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  getStudentDeployments,
  getStudentDeploymentCredentials,
  downloadStudentSshKey,
  type StudentDeploymentDto,
} from "../api/student";
import type { DeploymentCredentialsResponse } from "../api/deployments";
import { CredentialInstanceCard } from "../components/credentials/CredentialInstanceCard";

interface StudentDeploymentDetailsProps {
  deploymentId: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function StudentDeploymentDetails({
  deploymentId,
}: StudentDeploymentDetailsProps) {
  const navigate = useNavigate();

  // Backend liefert keinen Single-Endpoint /student/deployments/{id} —
  // wir holen die ganze Liste und filtern lokal. Klein genug (Student sieht
  // typischerweise <10 Deployments), kein Round-Trip-Optimum nötig.
  const [deployment, setDeployment] = useState<StudentDeploymentDto | null>(
    null,
  );
  const [deploymentLoading, setDeploymentLoading] = useState(true);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  const [credentialsData, setCredentialsData] =
    useState<DeploymentCredentialsResponse | null>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsError, setCredentialsError] = useState<string | null>(null);
  const [passwordVisibility, setPasswordVisibility] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    let cancelled = false;
    setDeploymentLoading(true);
    setDeploymentError(null);
    getStudentDeployments()
      .then((list) => {
        if (cancelled) return;
        const found = list.find((d) => d.id === deploymentId);
        if (!found) {
          setDeploymentError(
            "Dieses Deployment ist nicht (mehr) für dich freigegeben.",
          );
          return;
        }
        setDeployment(found);
      })
      .catch(() => {
        if (!cancelled) {
          setDeploymentError("Deployment konnte nicht geladen werden.");
        }
      })
      .finally(() => {
        if (!cancelled) setDeploymentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deploymentId]);

  const loadCredentials = useCallback(async () => {
    if (credentialsLoading) return;
    setCredentialsLoading(true);
    setCredentialsError(null);
    try {
      const data = await getStudentDeploymentCredentials(deploymentId);
      setCredentialsData(data);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 403) {
        setCredentialsError(
          "Du gehörst zu keiner Gruppe dieses Deployments mehr.",
        );
      } else if (status === 404) {
        setCredentialsError("Deployment nicht gefunden.");
      } else {
        setCredentialsError("Credentials konnten nicht geladen werden.");
      }
    } finally {
      setCredentialsLoading(false);
    }
  }, [credentialsLoading, deploymentId]);

  // Credentials sofort laden, sobald wir das Deployment kennen — Studenten
  // sind ausschließlich wegen der Credentials hier, kein extra Klick nötig.
  useEffect(() => {
    if (deployment && !credentialsData && !credentialsLoading && !credentialsError) {
      void loadCredentials();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployment]);

  const handleCopy = useCallback(async (value: string | null | undefined, label: string) => {
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

  const getMaskedPassword = (value: string | null | undefined) => {
    if (!value) return "-";
    return "*".repeat(Math.max(8, value.length));
  };

  const handleDownloadSshKey = useCallback(
    async (accessId: string, username: string | null) => {
      try {
        await downloadStudentSshKey(deploymentId, accessId, username);
        toast.success("SSH-Key heruntergeladen.");
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 403) {
          toast.error("Du hast keinen Zugriff auf diesen SSH-Key.");
        } else if (status === 404) {
          toast.error("Für diesen Zugang ist kein SSH-Key hinterlegt.");
        } else {
          toast.error("Download fehlgeschlagen.");
        }
      }
    },
    [deploymentId],
  );

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <button
        type="button"
        onClick={() => navigate("/student/dashboard")}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="w-4 h-4" />
        Zurück zur Übersicht
      </button>

      {deploymentLoading && (
        <Card className="border-slate-200">
          <CardContent className="py-10 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Lade Deployment...</span>
          </CardContent>
        </Card>
      )}

      {!deploymentLoading && deploymentError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="text-sm text-red-700">{deploymentError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/student/dashboard")}
              >
                Zur Übersicht
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!deploymentLoading && !deploymentError && deployment && (
        <>
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900 break-words">
              {deployment.name}
            </h1>
            <p className="text-sm text-slate-500 break-words">
              {deployment.template.name || "Template"}
              {deployment.template.version
                ? ` · v${deployment.template.version}`
                : ""}
            </p>
            {deployment.expires_at && (
              <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3.5 h-3.5" />
                Läuft ab am {formatDate(deployment.expires_at)}
              </p>
            )}
          </header>

          {/* VMs / Instances */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Virtuelle Maschinen</CardTitle>
              <CardDescription>
                {deployment.instances.length} VM
                {deployment.instances.length === 1 ? "" : "s"} sind dir
                zugewiesen.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {deployment.instances.length === 0 && (
                <p className="text-sm text-slate-500">
                  Aktuell keine VMs verfügbar.
                </p>
              )}
              {deployment.instances.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Server className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-900 truncate">
                      {inst.vm_name || inst.id}
                    </span>
                  </div>
                  {inst.ip_address ? (
                    <Badge variant="outline" className="font-mono text-xs">
                      {inst.ip_address}
                    </Badge>
                  ) : (
                    <span className="text-xs text-slate-400">keine IP</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Credentials */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Deine Zugangsdaten</CardTitle>
              <CardDescription>
                Username/Passwort und SSH-Keys deiner Gruppe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {credentialsLoading && (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Credentials werden geladen...</span>
                </div>
              )}

              {!credentialsLoading && credentialsError && (
                <div className="space-y-3">
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <span className="text-sm text-red-700">
                      {credentialsError}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadCredentials}>
                    Erneut versuchen
                  </Button>
                </div>
              )}

              {!credentialsLoading &&
                !credentialsError &&
                credentialsData &&
                credentialsData.instances.length === 0 && (
                  <p className="text-sm text-slate-500">
                    Aktuell keine Credentials für dich verfügbar.
                  </p>
                )}

              {!credentialsLoading &&
                !credentialsError &&
                credentialsData &&
                credentialsData.instances.length > 0 && (
                  <div className="space-y-4">
                    {credentialsData.instances.map((instance) => (
                      <CredentialInstanceCard
                        key={instance.instance_id}
                        instance={instance}
                        mode="student"
                        passwordVisibility={passwordVisibility}
                        togglePasswordVisibility={togglePasswordVisibility}
                        handleCopy={handleCopy}
                        getMaskedPassword={getMaskedPassword}
                        onDownloadSshKey={handleDownloadSshKey}
                      />
                    ))}
                  </div>
                )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
