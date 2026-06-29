// Student-Dashboard: listet alle Deployments, denen der eingeloggte Student
// über eine course_groups-Mitgliedschaft zugeordnet ist. Bewusst dünner als
// das Lecturer-Dashboard — kein OpenStack-Project-Filter (Backend filtert
// rein über CourseMember → CourseGroup → DeploymentInstanceAccess.group_id),
// keine Stats-Grid, keine Create/Delete/Extend-Buttons.
import { useEffect, useState } from "react";
import {
  Loader2,
  Server,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  getStudentDeployments,
  type StudentDeploymentDto,
} from "../api/student";

interface StudentDashboardProps {
  onSelectDeployment: (deploymentId: string) => void;
}

// Lokale Status-Badge-Map. Wir kopieren absichtlich nicht die Lecturer-
// Logik aus DeploymentDetails (die kennt Phasen / Failed-Mix-States), weil
// der Student-Endpoint diese Felder nicht ausliefert.
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "running":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
          Läuft
        </Badge>
      );
    case "queued":
    case "creating":
    case "deploying":
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          Wird bereitgestellt
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
          <XCircle className="w-3.5 h-3.5 mr-1.5" />
          Fehlgeschlagen
        </Badge>
      );
    case "deleting":
    case "deleted":
      return (
        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
          <Clock className="w-3.5 h-3.5 mr-1.5" />
          Wird entfernt
        </Badge>
      );
    default:
      return (
        <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
          {status}
        </Badge>
      );
  }
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

export function StudentDashboard({ onSelectDeployment }: StudentDashboardProps) {
  const [deployments, setDeployments] = useState<StudentDeploymentDto[] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getStudentDeployments()
      .then((data) => {
        if (!cancelled) setDeployments(data);
      })
      .catch((err) => {
        // 403 wäre theoretisch möglich (Token verloren Rolle), aber Backend
        // gibt für legitime Studenten ohne Group-Mitgliedschaft 200 + leere
        // Liste. Wir mappen also einen 403/401 auf Auth-Fehler, alles andere
        // auf generischen Fehlertext.
        const status = (err as { status?: number })?.status;
        if (status === 401 || status === 403) {
          setError(
            "Du bist nicht (mehr) als Student angemeldet — bitte erneut einloggen.",
          );
        } else {
          setError("Deployments konnten nicht geladen werden.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          Meine Deployments
        </h1>
        <p className="text-sm text-slate-500">
          Hier siehst du alle Umgebungen, die dir dein Dozent zugewiesen hat.
        </p>
      </header>

      {loading && (
        <Card className="border-slate-200">
          <CardContent className="py-10 flex items-center justify-center gap-2 text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Lade Deployments...</span>
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="space-y-2 flex-1">
              <p className="text-sm text-red-700">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Erneut versuchen
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && deployments && deployments.length === 0 && (
        // Empty-State: laut Briefing ist eine leere Liste ein erwarteter
        // 200-Response. Nicht als Fehler darstellen.
        <Card className="border-slate-200">
          <CardContent className="py-12 text-center space-y-2">
            <Server className="w-10 h-10 text-slate-400 mx-auto" />
            <p className="text-sm text-slate-700 font-medium">
              Aktuell keine Deployments für dich verfügbar.
            </p>
            <p className="text-xs text-slate-500">
              Du bist noch in keiner Gruppe eines Deployments — bitte wende dich
              an deinen Dozenten.
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && deployments && deployments.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {deployments.map((d) => (
            <Card
              key={d.id}
              className="border-slate-200 hover:border-teal-300 hover:shadow-md transition cursor-pointer"
              onClick={() => onSelectDeployment(d.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {d.name}
                    </CardTitle>
                    <CardDescription className="truncate">
                      {d.template.name || "Template"}
                      {d.template.version ? ` · v${d.template.version}` : ""}
                    </CardDescription>
                  </div>
                  <StatusBadge status={d.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Server className="w-3.5 h-3.5" />
                  <span>
                    {d.instances.length}{" "}
                    {d.instances.length === 1 ? "VM" : "VMs"}
                  </span>
                </div>
                {d.expires_at && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Läuft ab am {formatDate(d.expires_at)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
