// Owner-Detailansicht für ein Template — ersetzt für eigene Templates den
// generischen Details-Modal aus AppStore.tsx. Zeigt alle Felder, listet
// Versionen mit ihrem Approval-Status, und bietet zwei Aktionen:
//
//   • „Aktualisieren" — eine neuere bereits importierte Version aktivieren
//     (POST /api/v1/template-versions/{id}/activate). Kein Downgrade möglich:
//     die Auswahl ist auf strikt-neuere Versionen als die aktuell aktive
//     beschränkt (siehe `lib/version.ts → isStrictlyNewer`).
//
//   • „Approven/Ablehnen" — nur sichtbar für Admins (Backend setzt
//     `require_roles(ADMIN)` auf den Approve-Endpunkten). Wenn der Owner
//     selbst Admin ist, kann er das also auf seinem eigenen Template tun;
//     ansonsten muss ein Admin die Approval-Queue abarbeiten.
//
// Der eigentliche Versions-Upgrade-Dialog liegt in einem eigenen Component
// (UpgradeVersionDialog), damit das hier nicht zu groß wird.

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpCircle,
  Calendar,
  Check,
  CheckCircle2,
  CloudDownload,
  Eye,
  Github,
  GitBranch,
  Lock,
  MessageSquare,
  ShieldCheck,
  ShieldQuestion,
  X,
} from "lucide-react";
import { toast } from "sonner@2.0.3";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import {
  approveTemplateVersion,
  rejectTemplateVersion,
} from "../api/github";
import type { TemplateDto, TemplateVersionDto } from "../api/templates";
import { isStrictlyNewer } from "../lib/version";
import { UpgradeVersionDialog } from "./UpgradeVersionDialog";
import { CheckRemoteVersionsDialog } from "./CheckRemoteVersionsDialog";

interface Props {
  template: TemplateDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Wird aufgerufen, wenn sich am Template etwas geändert hat (Aktivierung,
   *  Approve, Reject) — die Liste oben sollte sich dann neu laden. */
  onChanged: () => void;
  isAdmin: boolean;
}

function ApprovalBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
        <ShieldCheck className="w-3 h-3 mr-1" />
        genehmigt
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
        <X className="w-3 h-3 mr-1" />
        abgelehnt
      </Badge>
    );
  }
  if (status === "deprecated") {
    return (
      <Badge variant="outline" className="text-slate-500">
        veraltet
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
      <ShieldQuestion className="w-3 h-3 mr-1" />
      offen
    </Badge>
  );
}

export function TemplateOwnerDetailDialog({
  template,
  open,
  onOpenChange,
  onChanged,
  isAdmin,
}: Props) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [checkRemoteOpen, setCheckRemoteOpen] = useState(false);
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null);
  const [rejectingVersionId, setRejectingVersionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Aufräumen, wenn der Dialog zugeht — verhindert, dass beim nächsten
  // Öffnen ein offener Reject-Block aus einer früheren Session sichtbar ist.
  useEffect(() => {
    if (!open) {
      setRejectingVersionId(null);
      setRejectionReason("");
      setBusyVersionId(null);
    }
  }, [open]);

  const versions: TemplateVersionDto[] = (template.versions ?? [])
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.created_at) - Date.parse(a.created_at),
    );

  const activeVersion = versions.find((v) => v.is_active);

  // Versionen, auf die der Owner hochziehen kann: strikt neuer als die
  // aktuelle aktive Version. Wenn (noch) keine aktive existiert, jede.
  const upgradeCandidates = versions.filter((v) => {
    if (v.is_active) return false;
    if (!activeVersion) return true;
    return isStrictlyNewer(v, activeVersion);
  });

  const handleApprove = async (versionId: string) => {
    setBusyVersionId(versionId);
    try {
      await approveTemplateVersion(versionId);
      toast.success("Version genehmigt.");
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Genehmigung fehlgeschlagen.",
      );
    } finally {
      setBusyVersionId(null);
    }
  };

  const handleReject = async (versionId: string) => {
    setBusyVersionId(versionId);
    try {
      await rejectTemplateVersion(
        versionId,
        rejectionReason.trim() || undefined,
      );
      toast.success("Version abgelehnt.");
      setRejectingVersionId(null);
      setRejectionReason("");
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Ablehnen fehlgeschlagen.",
      );
    } finally {
      setBusyVersionId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{template.name}</span>
              <Badge variant="outline" className="text-xs">
                eigenes Template
              </Badge>
            </DialogTitle>
            <DialogDescription>
              Verwalte Versionen, Sichtbarkeit und — als Admin — die Approval-
              Entscheidungen für dieses Template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {/* Status-Badges */}
            <div className="flex flex-wrap gap-2">
              <Badge
                className={
                  template.visibility === "public"
                    ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-100"
                }
              >
                {template.visibility === "public" ? (
                  <>
                    <Eye className="w-3 h-3 mr-1" /> Öffentlich
                  </>
                ) : (
                  <>
                    <Lock className="w-3 h-3 mr-1" /> Privat
                  </>
                )}
              </Badge>
              <ApprovalBadge status={template.approval_status} />
            </div>

            {/* Beschreibung */}
            <section>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Beschreibung
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {template.description || "Keine Beschreibung hinterlegt."}
              </p>
            </section>

            {/* Repo / Metadaten */}
            <section>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Quelle &amp; Metadaten
              </h3>
              <dl className="text-sm space-y-2">
                {template.repo_url && (
                  <div className="flex items-start gap-2">
                    <Github className="w-4 h-4 mt-0.5 text-slate-500" />
                    <div className="min-w-0 flex-1">
                      <dt className="text-xs text-slate-500">Repository</dt>
                      <dd>
                        <a
                          href={template.repo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:text-teal-700 break-all"
                        >
                          {template.repo_url}
                        </a>
                      </dd>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 mt-0.5 text-slate-500" />
                  <div>
                    <dt className="text-xs text-slate-500">Erstellt</dt>
                    <dd className="text-slate-700">
                      {new Date(template.created_at).toLocaleString("de-DE")}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 mt-0.5 text-slate-500" />
                  <div>
                    <dt className="text-xs text-slate-500">
                      Zuletzt aktualisiert
                    </dt>
                    <dd className="text-slate-700">
                      {new Date(template.updated_at).toLocaleString("de-DE")}
                    </dd>
                  </div>
                </div>
              </dl>
            </section>

            {/* Aktive Version + Update-Button */}
            <section>
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  Aktive Version
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setCheckRemoteOpen(true)}
                    title="Prüft das verknüpfte GitHub-Repo auf Tags und Commits, die noch nicht importiert sind."
                  >
                    <CloudDownload className="w-4 h-4 mr-2" />
                    Neue Versionen importieren
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={upgradeCandidates.length === 0}
                    onClick={() => setUpgradeOpen(true)}
                    title={
                      upgradeCandidates.length === 0
                        ? "Keine neuere Version verfügbar"
                        : undefined
                    }
                  >
                    <ArrowUpCircle className="w-4 h-4 mr-2" />
                    Aktualisieren
                  </Button>
                </div>
              </div>
              {activeVersion ? (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                      {activeVersion.version}
                    </Badge>
                    <span className="text-xs text-green-600 font-medium">
                      Aktiv
                    </span>
                    <ApprovalBadge status={activeVersion.approval_status as string} />
                  </div>
                  <p className="text-xs text-slate-500 mt-2 font-mono break-all">
                    {activeVersion.git_commit_sha}
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Kein aktiver Versionsstand. Das Template kann erst
                    deployed werden, sobald eine genehmigte Version aktiv ist.
                  </span>
                </div>
              )}
            </section>

            {/* Versionsliste mit Approve/Reject */}
            <section>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">
                Alle Versionen ({versions.length})
              </h3>
              {versions.length === 0 && (
                <p className="text-sm text-slate-500 italic">
                  Noch keine Versionen importiert.
                </p>
              )}
              <ul className="space-y-2">
                {versions.map((version) => {
                  const isPending = version.approval_status === "pending";
                  const showAdminActions = isAdmin && isPending;
                  return (
                    <li
                      key={version.id}
                      className="p-3 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline">{version.version}</Badge>
                            {version.is_active && (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                aktiv
                              </Badge>
                            )}
                            <ApprovalBadge
                              status={version.approval_status as string}
                            />
                          </div>
                          <p className="text-xs text-slate-500 mt-1 font-mono break-all">
                            <GitBranch className="w-3 h-3 inline mr-1" />
                            {version.git_commit_sha}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            {new Date(version.created_at).toLocaleString(
                              "de-DE",
                            )}
                          </p>
                          {version.rejection_reason && (
                            <p className="text-xs text-red-700 mt-2 italic">
                              Begründung: {version.rejection_reason}
                            </p>
                          )}
                        </div>

                        {showAdminActions && (
                          <div className="flex items-center gap-2 shrink-0">
                            {rejectingVersionId === version.id ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRejectingVersionId(null);
                                  setRejectionReason("");
                                }}
                              >
                                Abbrechen
                              </Button>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setRejectingVersionId(version.id);
                                    setRejectionReason("");
                                  }}
                                  disabled={busyVersionId === version.id}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Ablehnen
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={() => handleApprove(version.id)}
                                  disabled={busyVersionId === version.id}
                                >
                                  <Check className="w-4 h-4 mr-2" />
                                  Genehmigen
                                </Button>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Ausgeklappter Reject-Bereich (nur Admin) */}
                      {rejectingVersionId === version.id && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <MessageSquare className="w-4 h-4 text-slate-600" />
                            <span className="text-sm text-slate-700">
                              Optionaler Hinweis bei Ablehnung
                            </span>
                          </div>
                          <Textarea
                            value={rejectionReason}
                            onChange={(e) =>
                              setRejectionReason(e.target.value)
                            }
                            placeholder="z. B. Heat-Template referenziert undefinierten Parameter X"
                            rows={3}
                          />
                          <div className="flex justify-end mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleReject(version.id)}
                              disabled={busyVersionId === version.id}
                            >
                              Ablehnung bestätigen
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {!isAdmin && versions.some((v) => v.approval_status === "pending") && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Es liegen Versionen zur Genehmigung in der Approval-Queue.
                  Sobald ein Admin sie freigibt, erscheinen sie für Deploy-
                  Vorgänge.
                </span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Schließen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UpgradeVersionDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        candidates={upgradeCandidates}
        activeVersion={activeVersion ?? null}
        onActivated={() => {
          setUpgradeOpen(false);
          onChanged();
        }}
      />

      <CheckRemoteVersionsDialog
        template={template}
        open={checkRemoteOpen}
        onOpenChange={setCheckRemoteOpen}
        onImported={() => {
          // Liste neu laden, damit die frisch importierten Versionen
          // in der Versionsliste und im Aktualisieren-Dialog auftauchen.
          onChanged();
        }}
      />
    </>
  );
}
