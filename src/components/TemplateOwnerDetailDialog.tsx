// Owner-Detailansicht für ein Template — ersetzt für eigene Templates den
// generischen Details-Modal aus AppStore.tsx. Zeigt alle Felder, listet
// Versionen mit ihrem Approval-Status, und bietet zwei Aktionen:
//
//   • „Aktive Version ändern" — eine bereits importierte Version zur aktiven
//     (= Standard-Vorauswahl im Deployment-Wizard) machen
//     (POST /api/v1/template-versions/{id}/activate). Downgrades auf ältere
//     Versionen sind erlaubt — die Auswahl umfasst ALLE nicht-aktiven
//     Versionen, ohne Strict-Newer-Beschränkung.
//
//   • „Approven/Ablehnen" — nur sichtbar für Admins (Backend setzt
//     `require_roles(ADMIN)` auf den Approve-Endpunkten). Wenn der Owner
//     selbst Admin ist, kann er das also auf seinem eigenen Template tun;
//     ansonsten muss ein Admin die Approval-Queue abarbeiten.
//
// Der eigentliche „Aktive Version ändern"-Dialog liegt in einem eigenen
// Component (ChangeActiveVersionDialog, datei UpgradeVersionDialog.tsx aus
// Migration-Gründen), damit das hier nicht zu groß wird.

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeftRight,
  Calendar,
  Check,
  CheckCircle2,
  CloudDownload,
  Eye,
  Github,
  GitBranch,
  Lock,
  MessageSquare,
  Pencil,
  Trash2,
  User,
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { ApprovalBadge } from "./ApprovalBadge";
import {
  approveTemplateVersion,
  rejectTemplateVersion,
} from "../api/github";
import {
  deleteTemplate,
  deleteTemplateVersion,
  updateTemplate,
  type TemplateDto,
  type TemplateUpdatePayload,
  type TemplateVersionDto,
} from "../api/templates";
import { deriveTemplateOverallStatus } from "../lib/template-status";
import { ChangeActiveVersionDialog } from "./UpgradeVersionDialog";
import { CheckRemoteVersionsDialog } from "./CheckRemoteVersionsDialog";
import { TemplateIconUpload } from "./TemplateIconUpload";

interface Props {
  template: TemplateDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Wird aufgerufen, wenn sich am Template etwas geändert hat (Aktivierung,
   *  Approve, Reject) — die Liste oben sollte sich dann neu laden. */
  onChanged: () => void;
  isAdmin: boolean;
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
  // Visibility-Toggle: seit Backend-Commit 2641a01 ("approval flow applies
  // only to public templates") darf das Owner-or-Admin — der frühere
  // Admin-only-Riegel im Service ist weg. Wir blenden den Button daher für
  // alle ein, die diesen Dialog sehen (Owner sehen ihn; Admins sehen alle).
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  // Visibility-Wechsel ist nicht-destruktiv-aber-folgenreich: das Backend
  // räumt bei public → private den kompletten Approval-Status aller Versionen
  // ab (approval_status=null, approved_by/_at/reason geleert), bei
  // private → public werden alle null-Versionen auf pending gesetzt. Daher
  // erst confirmen, dann patchen.
  const [confirmVisibilityChange, setConfirmVisibilityChange] = useState(false);

  // Edit-Modus für Metadaten (name/description/repo_url). Visibility
  // hat seinen eigenen Toggle weiter oben, daher hier nicht enthalten.
  // Icon-Management läuft über separate Upload/Delete-Endpoints.
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(template.name);
  const [editDescription, setEditDescription] = useState(template.description ?? "");
  const [editRepoUrl, setEditRepoUrl] = useState(template.repo_url);
  const [editBusy, setEditBusy] = useState(false);

  // Bestätigungsdialoge für destruktive Aktionen.
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [confirmDeleteVersionId, setConfirmDeleteVersionId] = useState<string | null>(null);
  const [deletingVersionId, setDeletingVersionId] = useState<string | null>(null);

  // Aufräumen, wenn der Dialog zugeht — verhindert, dass beim nächsten
  // Öffnen ein offener Reject-Block aus einer früheren Session sichtbar ist.
  useEffect(() => {
    if (!open) {
      setRejectingVersionId(null);
      setRejectionReason("");
      setBusyVersionId(null);
      setEditing(false);
      setConfirmDeleteTemplate(false);
      setConfirmDeleteVersionId(null);
    }
  }, [open]);

  // Wenn von außen ein frisches Template-Objekt reinkommt (nach onChanged-
  // Refetch), die Edit-Felder mitziehen — sonst zeigt der Edit-Modus alte
  // Werte aus dem ersten Render-Zyklus.
  useEffect(() => {
    setEditName(template.name);
    setEditDescription(template.description ?? "");
    setEditRepoUrl(template.repo_url);
  }, [template.id, template.name, template.description, template.repo_url]);

  const versions: TemplateVersionDto[] = (template.versions ?? [])
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.created_at) - Date.parse(a.created_at),
    );

  const activeVersion = versions.find((v) => v.is_active);

  // Approval lebt nur noch pro Version (Backend-Migration
  // a7c4f2b91d34_per_version_approval_and_github_app). Aus dem Versionsstand
  // leiten wir hier eine UI-taugliche Aggregations-Bewertung ab.
  const overallStatus = deriveTemplateOverallStatus(template);

  // Kandidaten für „Aktive Version ändern": alle nicht-aktiven Versionen.
  // Bewusst KEIN strict-newer-Filter mehr — der Owner darf jederzeit auch
  // zu einer älteren Version zurück (z.B. wenn die jüngste einen Bug
  // hat). Backend (`activate_version` + `deactivate_other_versions`)
  // unterstützt den Switch in beide Richtungen atomar.
  const activeChangeCandidates = versions.filter((v) => !v.is_active);

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

  // Visibility umschalten — seit Backend-Commit 2641a01 für Owner-or-Admin
  // erlaubt. Der eigentliche PATCH läuft erst nach Bestätigung im
  // Confirm-Dialog (siehe `confirmVisibilityChange`), damit der Nutzer den
  // Side-Effect auf die Versionen versteht, bevor er ihn auslöst.
  const handleToggleVisibility = async () => {
    const next = template.visibility === "public" ? "private" : "public";
    setVisibilityBusy(true);
    try {
      await updateTemplate(template.id, { visibility: next });
      toast.success(
        next === "public"
          ? "Template ist jetzt öffentlich."
          : "Template ist jetzt privat.",
      );
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Sichtbarkeit konnte nicht geändert werden.",
      );
    } finally {
      setVisibilityBusy(false);
      setConfirmVisibilityChange(false);
    }
  };

  // Metadaten-Edit speichern — nur die tatsächlich geänderten Felder ans
  // Backend schicken, damit kein unnötiger Diff entsteht und PATCH
  // semantisch sauber bleibt.
  const handleSaveEdit = async () => {
    const patch: TemplateUpdatePayload = {};
    if (editName.trim() && editName !== template.name) patch.name = editName.trim();
    const nextDesc = editDescription.trim() === "" ? null : editDescription;
    if ((template.description ?? null) !== nextDesc) patch.description = nextDesc;
    if (editRepoUrl.trim() && editRepoUrl !== template.repo_url) patch.repo_url = editRepoUrl.trim();

    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }

    setEditBusy(true);
    try {
      await updateTemplate(template.id, patch);
      toast.success("Template-Daten aktualisiert.");
      setEditing(false);
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Aktualisierung fehlgeschlagen.",
      );
    } finally {
      setEditBusy(false);
    }
  };

  // Template komplett löschen. Backend kaskadiert über alle Versionen/Files;
  // nach Erfolg schließen wir den Dialog und lassen die Parent-Komponente
  // die Liste neu laden.
  const handleDeleteTemplate = async () => {
    setDeletingTemplate(true);
    try {
      await deleteTemplate(template.id);
      toast.success("Template gelöscht.");
      setConfirmDeleteTemplate(false);
      onOpenChange(false);
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Löschen fehlgeschlagen.",
      );
    } finally {
      setDeletingTemplate(false);
    }
  };

  // Einzelne Version löschen. Backend blockt das Löschen der einzigen
  // aktiven Version mit 400 — wir lassen den Button für genau diesen Fall
  // gar nicht erst zu (siehe `canDeleteVersion`-Hilfsfunktion unten).
  const handleDeleteVersion = async (versionId: string) => {
    setDeletingVersionId(versionId);
    try {
      await deleteTemplateVersion(versionId);
      toast.success("Version gelöscht.");
      setConfirmDeleteVersionId(null);
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Löschen fehlgeschlagen.",
      );
    } finally {
      setDeletingVersionId(null);
    }
  };

  // Spiegelt die Backend-Regel aus `template_version_service.delete_version`:
  // die einzige aktive Version eines Templates darf nicht gelöscht werden.
  // (Es gibt entweder eine zweite aktive Version — was das Service-Konstrukt
  // eigentlich vermeidet — oder die zu löschende Version ist nicht aktiv.)
  const activeCount = useMemo(
    () => versions.filter((v) => v.is_active).length,
    [versions],
  );
  const canDeleteVersion = (v: TemplateVersionDto) =>
    !v.is_active || activeCount > 1;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 min-w-0">
              <span className="break-words min-w-0">{template.name}</span>
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
            <div className="flex flex-wrap items-center gap-2">
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
              <ApprovalBadge status={overallStatus} variant="overall" />
              {/* Sichtbarkeits-Umschalter — seit Backend-Commit 2641a01 für
                  Owner-or-Admin erlaubt. Dieser Dialog erscheint nur für
                  eigene Templates (siehe AppStore.tsx) bzw. für Admins, also
                  zeigen wir den Button konstant an. */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmVisibilityChange(true)}
                disabled={visibilityBusy}
                className="h-7 text-xs"
                title={
                  template.visibility === "public"
                    ? "Auf privat zurückstellen — Template ist dann nur noch für Owner und Admins sichtbar."
                    : "Auf öffentlich schalten — Template wird für alle User sichtbar, sobald mindestens eine approvte Version existiert."
                }
              >
                {visibilityBusy
                  ? "Wird geändert…"
                  : template.visibility === "public"
                    ? "Auf privat stellen"
                    : "Öffentlich schalten"}
              </Button>
            </div>

            {/* Beschreibung + Metadaten — editierbar via Edit-Toggle.
                Owner-or-Admin laut Backend (`template_service.update_template`).
                Visibility wird hier bewusst NICHT mit-editiert, weil sie ihren
                eigenen Toggle oben in der Status-Zeile hat. */}
            {!editing ? (
              <>
                <section>
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">
                      Beschreibung
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(true)}
                      className="h-7 text-xs"
                    >
                      <Pencil className="w-3 h-3 mr-1" /> Bearbeiten
                    </Button>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {template.description || "Keine Beschreibung hinterlegt."}
                  </p>
                </section>

                <section>
                  <h3 className="text-sm font-semibold text-slate-900 mb-2">
                    Quelle &amp; Metadaten
                  </h3>
                  <dl className="text-sm space-y-2">
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 mt-0.5 text-slate-500" />
                      <div>
                        <dt className="text-xs text-slate-500">Hochgeladen von</dt>
                        <dd className="text-slate-700">
                          {template.owner_name || template.owner_username || template.owner_id}
                        </dd>
                      </div>
                    </div>
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
              </>
            ) : (
              <section className="space-y-3 p-3 rounded-lg border border-slate-200 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-900">
                  Template bearbeiten
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="tpl-edit-name" className="text-xs">Name</Label>
                  <Input
                    id="tpl-edit-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={255}
                    disabled={editBusy}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tpl-edit-desc" className="text-xs">Beschreibung</Label>
                  <Textarea
                    id="tpl-edit-desc"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                    disabled={editBusy}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tpl-edit-repo" className="text-xs">Repository-URL</Label>
                  <Input
                    id="tpl-edit-repo"
                    value={editRepoUrl}
                    onChange={(e) => setEditRepoUrl(e.target.value)}
                    maxLength={500}
                    disabled={editBusy}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditing(false);
                      // Felder auf den aktuellen Backend-Stand zurücksetzen,
                      // damit der nächste Edit-Aufruf bei null beginnt.
                      setEditName(template.name);
                      setEditDescription(template.description ?? "");
                      setEditRepoUrl(template.repo_url);
                    }}
                    disabled={editBusy}
                  >
                    Abbrechen
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveEdit}
                    disabled={editBusy || !editName.trim() || !editRepoUrl.trim()}
                    className="bg-teal-500 hover:bg-teal-600 text-white"
                  >
                    {editBusy ? "Speichert…" : "Speichern"}
                  </Button>
                </div>
              </section>
            )}

            {/* Icon-Upload — immer sichtbar, außerhalb des Edit-Modus,
                da Upload/Delete separate Endpoints sind und keinen Abbruch
                oder Speichern-Button brauchen. */}
            <section>
              <TemplateIconUpload
                templateId={template.id}
                iconPath={template.icon_path}
                onChanged={onChanged}
                uploadTrigger={Date.parse(template.updated_at)}
              />
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
                    disabled={activeChangeCandidates.length === 0}
                    onClick={() => setUpgradeOpen(true)}
                    title={
                      activeChangeCandidates.length === 0
                        ? "Es gibt keine weitere Version, die du aktivieren könntest"
                        : "Aktive Version (Standard-Vorauswahl im Deployment-Wizard) ändern"
                    }
                  >
                    <ArrowLeftRight className="w-4 h-4 mr-2" />
                    Aktive Version ändern
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
                    <ApprovalBadge status={activeVersion.approval_status} variant="version" />
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
                  // Approval-Flow läuft seit dem Backend-Briefing in #122
                  // nur noch für Public-Templates. Bei Legacy-Daten kann ein
                  // Private-Template noch eine pending-Version tragen — der
                  // Approve/Reject-API würde dort 400 antworten. Visibility
                  // ist die Quelle der Wahrheit, deshalb hier zusätzlich gaten.
                  const isPublic = template.visibility === "public";
                  const showAdminActions = isAdmin && isPending && isPublic;
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
                              status={version.approval_status}
                              variant="version"
                              tooltip={
                                version.approval_status === "rejected"
                                  ? version.rejection_reason ?? undefined
                                  : undefined
                              }
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

                        {/* Version löschen — Owner-or-Admin laut Backend
                            (`template_version_service.delete_version`). Dieser
                            Dialog wird nur für eigene Templates geöffnet
                            (siehe AppStore.tsx), darum erscheint der Button
                            ohne weitere Rollenprüfung. Die einzige aktive
                            Version blockt das Backend mit 400 — daher hier
                            schon disabled, damit das gar nicht erst passiert. */}
                        {rejectingVersionId !== version.id && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                            onClick={() => setConfirmDeleteVersionId(version.id)}
                            disabled={
                              deletingVersionId === version.id ||
                              !canDeleteVersion(version)
                            }
                            title={
                              !canDeleteVersion(version)
                                ? "Die einzige aktive Version kann nicht gelöscht werden — zuerst eine andere aktivieren."
                                : "Version dauerhaft löschen."
                            }
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Löschen
                          </Button>
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

            {/* Hinweis nur bei public-Templates: Approval-Flow läuft seit
                #122 ausschließlich für public. Bei einem Legacy-Private-
                Template mit pending-Versionen würde der Banner sonst auf
                eine Approval-Queue verweisen, die für dieses Template nie
                feuert. */}
            {!isAdmin
              && template.visibility === "public"
              && versions.some((v) => v.approval_status === "pending") && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-blue-800">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Es liegen Versionen zur Genehmigung in der Approval-Queue.
                  Sobald ein Admin sie freigibt, erscheinen sie für Deploy-
                  Vorgänge.
                </span>
              </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-slate-200">
              {/* Destruktive Aktion ganz links, von „Schließen" optisch getrennt
                  — Owner-or-Admin laut Backend (`template_service.delete_template`).
                  Backend kaskadiert über alle Versionen und Files. */}
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                onClick={() => setConfirmDeleteTemplate(true)}
                disabled={deletingTemplate}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Template löschen
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Schließen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ChangeActiveVersionDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        candidates={activeChangeCandidates}
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
          // in der Versionsliste und im „Aktive Version ändern"-Dialog auftauchen.
          onChanged();
        }}
      />

      {/* Confirm: Template komplett löschen. AlertDialog statt eigener
          Dialog-Komponente, weil das semantisch eine destruktive
          Bestätigung ist und Radix dann den Focus-Lock korrekt umleitet. */}
      <AlertDialog
        open={confirmDeleteTemplate}
        onOpenChange={(o) => !deletingTemplate && setConfirmDeleteTemplate(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Template „{template.name}" löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Das Template, alle {versions.length} Version
              {versions.length === 1 ? "" : "en"} und die zugehörigen Dateien
              werden dauerhaft entfernt. Bestehende Deployments aus diesem
              Template laufen weiter, lassen sich aber nicht neu erstellen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="mt-0" disabled={deletingTemplate}>
              Abbrechen
            </AlertDialogCancel>
            <Button
              type="button"
              style={{ backgroundColor: "#dc2626", color: "#ffffff" }}
              onClick={handleDeleteTemplate}
              disabled={deletingTemplate}
            >
              {deletingTemplate ? "Wird gelöscht…" : "Löschen"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: einzelne Version löschen. Identisches Pattern. */}
      <AlertDialog
        open={confirmDeleteVersionId !== null}
        onOpenChange={(o) => !deletingVersionId && !o && setConfirmDeleteVersionId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Version{" "}
              {versions.find((v) => v.id === confirmDeleteVersionId)?.version ??
                ""}{" "}
              löschen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Die Version und alle Files dieser Version werden dauerhaft
              entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel
              className="mt-0"
              disabled={deletingVersionId !== null}
            >
              Abbrechen
            </AlertDialogCancel>
            <Button
              type="button"
              style={{ backgroundColor: "#dc2626", color: "#ffffff" }}
              onClick={() =>
                confirmDeleteVersionId &&
                handleDeleteVersion(confirmDeleteVersionId)
              }
              disabled={deletingVersionId !== null}
            >
              {deletingVersionId !== null ? "Wird gelöscht…" : "Löschen"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Confirm: Visibility-Wechsel. Beide Richtungen sind technisch
          non-destruktiv, aber beide räumen Server-seitig in den Versionen
          auf — Briefing aus #122 fordert daher explizit eine Warnung. */}
      <AlertDialog
        open={confirmVisibilityChange}
        onOpenChange={(o) => !visibilityBusy && setConfirmVisibilityChange(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {template.visibility === "public"
                ? "Template auf privat zurückstellen?"
                : "Template öffentlich machen?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {template.visibility === "public"
                ? "Approval-Status aller Versionen wird zurückgesetzt; das Template ist danach nur für dich (und Admins) sichtbar. Bestehende Deployments laufen weiter."
                : 'Alle bisher privaten Versionen werden zur Admin-Freigabe vorgemerkt (Status „wartet auf Freigabe"). Sobald mindestens eine Version freigegeben ist, taucht das Template im öffentlichen App Store auf.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="mt-0" disabled={visibilityBusy}>
              Abbrechen
            </AlertDialogCancel>
            <Button
              type="button"
              onClick={handleToggleVisibility}
              disabled={visibilityBusy}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              {visibilityBusy
                ? "Wird geändert…"
                : template.visibility === "public"
                  ? "Auf privat stellen"
                  : "Öffentlich schalten"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
