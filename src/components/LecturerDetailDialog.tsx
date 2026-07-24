// Detail-View für einen Lecturer-Account. Zeigt Metadaten (Name/Email/last
// login) und die drei Ressourcen-Kategorien (Templates, Deployments,
// OpenStack-Projekte) mit allen relevanten Feldern, damit der Admin vor dem
// Cascade-Delete sieht was er kaputtmacht.
//
// Nach dem Delete pollt dieser Dialog die Detail-View im 2-Sekunden-Takt,
// bis das Backend 404 liefert (= User weg → Erfolg) oder ein Timeout
// erreicht ist. Bei Timeout bleibt der Modal offen und zeigt einen
// „refreshen"-Hinweis — die Löschung läuft weiter, aber vermutlich ist an
// einem Deployment ein Heat-Stack hängen geblieben und der Admin muss
// nachschauen.

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Cloud,
  Layers,
  Loader2,
  Mail,
  RefreshCw,
  Server,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner@2.0.3";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ApiError } from "../api/http";
import {
  getLecturer,
  type LecturerDetail,
  type LecturerListItem,
} from "../api/lecturers";
import { DeleteLecturerConfirmDialog } from "./DeleteLecturerConfirmDialog";

interface Props {
  /** Die Zeilendaten aus der Liste — dienen als initiale Anzeige, während
   *  die vollständigen Ressourcen-Listen geladen werden. */
  lecturer: LecturerListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Wird aufgerufen, sobald der Delete-Task erfolgreich durchgelaufen
   *  ist (Polling hat 404 gesehen). Die aufrufende Liste sollte dann
   *  neuladen. */
  onDeleted: () => void;
}

const POLL_INTERVAL_MS = 2000;
// Nach ~30s soll der Modal aufgeben und den Admin auf „manuell prüfen"
// verweisen — Backend-Dokumentation sagt genau das für den Fall dass ein
// Heat-Stack sich nicht abbauen lässt.
const POLL_TIMEOUT_MS = 30_000;

export function LecturerDetailDialog({
  lecturer,
  open,
  onOpenChange,
  onDeleted,
}: Props) {
  const [detail, setDetail] = useState<LecturerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // deletionState fasst den Post-Delete-Polling-Lebenszyklus zusammen. `idle`
  // = kein Delete läuft; `polling` = wir warten aufs Verschwinden; `timeout`
  // = 30s ohne 404 → Backend ist noch dran, Admin soll refreshen.
  const [deletionState, setDeletionState] =
    useState<"idle" | "polling" | "timeout">("idle");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollDeadlineRef = useRef<number>(0);

  const clearPollTimer = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getLecturer(lecturer.id);
      setDetail(resp.data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Kann passieren, wenn zwischen Liste und Detail parallel gelöscht
        // wurde. Für die Detail-Öffnung ist das ein Fehler, für ein aktives
        // Polling-Ergebnis dagegen der Erfolgsfall — der Polling-Handler
        // fängt 404 separat ab.
        setError("Dieser Lecturer existiert nicht (mehr).");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Detail konnte nicht geladen werden.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Beim Öffnen den Detail-Endpoint anziehen. Bei jedem Reopen frisch
  // ziehen, weil sich zwischenzeitlich Ressourcen geändert haben können.
  useEffect(() => {
    if (!open) return;
    setDeletionState("idle");
    clearPollTimer();
    void loadDetail();
    return () => {
      clearPollTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lecturer.id]);

  // Ein enqueue’ter Delete startet das Polling. Wir prüfen mit getLecturer:
  // 404 → User weg → Erfolg. Alles andere = Backend arbeitet noch.
  const startPolling = () => {
    setDeletionState("polling");
    pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS;
    clearPollTimer();
    pollTimerRef.current = setInterval(async () => {
      try {
        await getLecturer(lecturer.id);
        // 200 — User existiert noch. Weiter warten bis Deadline.
        if (Date.now() > pollDeadlineRef.current) {
          clearPollTimer();
          setDeletionState("timeout");
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          clearPollTimer();
          setDeletionState("idle");
          toast.success("Lecturer-Account wurde gelöscht.");
          onDeleted();
          onOpenChange(false);
        } else if (Date.now() > pollDeadlineRef.current) {
          clearPollTimer();
          setDeletionState("timeout");
        }
      }
    }, POLL_INTERVAL_MS);
  };

  const handleDeleteEnqueued = (taskId: string) => {
    toast.info(
      `Löschung läuft im Hintergrund (Task ${taskId.slice(0, 8)}…). ` +
        "Der Modal aktualisiert sich automatisch.",
    );
    startPolling();
  };

  const closeIfIdle = (nextOpen: boolean) => {
    // Modal darf nicht während des Pollings zugeklickt werden — sonst geht
    // der Refresh-State verloren. Der Admin kann via „Abbrechen" trotzdem
    // zurück, aber er soll bewusst entscheiden.
    if (!nextOpen && deletionState === "polling") return;
    onOpenChange(nextOpen);
  };

  const displayName =
    detail?.display_name ??
    lecturer.display_name ??
    lecturer.username ??
    lecturer.email ??
    lecturer.id;
  const email = detail?.email ?? lecturer.email;
  const username = detail?.username ?? lecturer.username;
  const lastLoginAt = detail?.last_login_at ?? lecturer.last_login_at;

  return (
    <>
      <Dialog open={open} onOpenChange={closeIfIdle}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 break-words">
              <User className="w-5 h-5 text-slate-500" />
              {displayName}
            </DialogTitle>
            <DialogDescription>
              Vollständige Übersicht der Ressourcen dieses Lecturer-Accounts.
              Vor einem Cascade-Delete bitte prüfen was mitgelöscht wird.
            </DialogDescription>
          </DialogHeader>

          {/* Metadaten-Panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border rounded-lg p-4 bg-slate-50 text-sm">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500">Email:</span>
              <span className="text-slate-900 break-all">{email ?? "—"}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500">Username:</span>
              <span className="text-slate-900 break-all">
                {username ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500">Letzter Login:</span>
              <span className="text-slate-900">
                {lastLoginAt ? new Date(lastLoginAt).toLocaleString() : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 shrink-0">Keycloak-Sub:</span>
              <span className="text-slate-900 font-mono text-xs break-all">
                {detail?.external_id ?? lecturer.external_id}
              </span>
            </div>
          </div>

          {/* Post-Delete Feedback */}
          {deletionState === "polling" && (
            <div className="flex items-center gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <Loader2 className="w-4 h-4 animate-spin" />
              <div>
                <p className="font-semibold">Cascade-Delete läuft…</p>
                <p>
                  Wir prüfen alle {POLL_INTERVAL_MS / 1000}s ob der Account
                  weg ist. Dieser Modal schließt sich automatisch bei Erfolg.
                </p>
              </div>
            </div>
          )}
          {deletionState === "timeout" && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Löschung nicht abgeschlossen
              </p>
              <p className="mt-1">
                Der Account existiert nach {POLL_TIMEOUT_MS / 1000}s immer noch.
                Wahrscheinlich hängt ein Heat-Stack — bitte die betroffenen
                Deployments unten öffnen und ggf. manuell abbauen. Danach kann
                der Delete erneut ausgelöst werden.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setDeletionState("idle");
                  void loadDetail();
                }}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Neu laden
              </Button>
            </div>
          )}

          {/* Body */}
          {loading && !detail && (
            <div className="p-6 text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Lade Ressourcen…
            </div>
          )}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {detail && (
            <div className="space-y-6">
              {/* Templates */}
              <ResourceSection
                icon={<Layers className="w-4 h-4 text-teal-600" />}
                title="Templates"
                count={detail.template_count}
                emptyLabel="Keine Templates"
              >
                {detail.templates.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-slate-900 break-words">{t.name}</p>
                      <p className="text-xs text-slate-500 font-mono break-all">
                        {t.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={
                          t.visibility === "public"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-slate-50 text-slate-600"
                        }
                      >
                        {t.visibility === "public" ? "Öffentlich" : "Privat"}
                      </Badge>
                      <Badge variant="outline">
                        {t.version_count} Version
                        {t.version_count === 1 ? "" : "en"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </ResourceSection>

              {/* Deployments */}
              <ResourceSection
                icon={<Server className="w-4 h-4 text-blue-600" />}
                title="Deployments"
                count={detail.deployment_count}
                emptyLabel="Keine Deployments"
              >
                {detail.deployments.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-slate-900 break-words">{d.name}</p>
                      <p className="text-xs text-slate-500">
                        Erstellt {new Date(d.created_at).toLocaleDateString()}
                        {d.expires_at && (
                          <>
                            {" · Läuft ab "}
                            {new Date(d.expires_at).toLocaleDateString()}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <Badge
                        variant="outline"
                        className={statusColor(d.status)}
                      >
                        {d.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </ResourceSection>

              {/* OpenStack-Projekte */}
              <ResourceSection
                icon={<Cloud className="w-4 h-4 text-purple-600" />}
                title="OpenStack-Projekte"
                count={detail.openstack_project_count}
                emptyLabel="Keine OpenStack-Projekte"
              >
                {detail.openstack_projects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 py-2 border-b last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-slate-900 break-words">
                        {p.openstack_project_name}
                      </p>
                      <p className="text-xs text-slate-500 font-mono break-all">
                        {p.id}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {p.region_name}
                    </Badge>
                  </div>
                ))}
              </ResourceSection>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={deletionState === "polling"}
            >
              Schließen
            </Button>
            <Button
              variant="destructive"
              onClick={() => setConfirmOpen(true)}
              disabled={
                !detail || loading || deletionState !== "idle"
              }
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Account löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detail && (
        <DeleteLecturerConfirmDialog
          lecturer={detail}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          onDeleteEnqueued={handleDeleteEnqueued}
        />
      )}
    </>
  );
}

// -- Sub-Komponenten -------------------------------------------------------

function ResourceSection({
  icon,
  title,
  count,
  emptyLabel,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="text-slate-900">{title}</h4>
        <Badge variant="outline">{count}</Badge>
      </div>
      {count === 0 ? (
        <p className="text-sm text-slate-500 flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4 text-slate-400" />
          {emptyLabel}
        </p>
      ) : (
        <div className="text-sm">{children}</div>
      )}
    </section>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "running":
      return "bg-green-50 text-green-700 border-green-200";
    case "failed":
    case "error":
      return "bg-red-50 text-red-700 border-red-200";
    case "creating":
    case "updating":
    case "deleting":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-slate-50 text-slate-600";
  }
}
