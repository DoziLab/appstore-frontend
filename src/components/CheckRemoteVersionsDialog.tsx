// „Neue Versionen aus GitHub importieren" — drei-Schritte-Dialog:
//
//   1. Prüfen   → fragt anonyme GitHub-API (`/tags`, `/commits/{ref}`) für
//                 das im Template hinterlegte Repo ab und filtert raus,
//                 was schon importiert ist.
//   2. Auswahl  → zeigt die gefundenen Kandidaten, Owner wählt per
//                 Checkbox, welche importiert werden sollen.
//   3. Bestätigung → kurzer „Sicher? n Versionen werden importiert"-
//                    Schritt. Confirm → ruft pro Kandidat
//                    `POST /api/v1/templates/{id}/import-from-github`
//                    sequenziell (das Backend macht echte GitHub-Roundtrips
//                    pro Call — parallelisieren bringt Race-Risiken bei der
//                    unique-(template_id, commit_sha)-Constraint).
//
// Edge-Cases:
// • Privates Repo → anonymer Call gibt 404 → wir zeigen einen sauberen
//   Hinweis statt eines Rohfehlers.
// • Backend-Doppelimport-Schutz: schlägt fehl mit
//   „This template already has a version for commit ..." → individueller
//   Toast, aber wir brechen den Batch nicht ab.
// • Rate-Limit der anonymen GitHub-API (60/h) → eigene Fehlermeldung.

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  GitBranch,
  Github,
  Loader2,
  RefreshCcw,
  Replace,
  Tag,
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
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Alert, AlertDescription } from "./ui/alert";
import {
  fetchRemoteCandidates,
  RemoteCheckError,
  type RemoteCandidate,
  type RemoteCheckResult,
} from "../lib/github-remote";
import { buildGithubEditUrl, buildGithubUrl } from "../lib/github-url";
import {
  importTemplateVersionFromGithub,
  VERSION_ERROR_CODES,
  type VersionErrorCode,
} from "../api/github";
import { ApiError } from "../api/http";
import type { TemplateDto } from "../api/templates";

interface Props {
  template: TemplateDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

type Step = "idle" | "checking" | "select" | "confirm" | "importing" | "done";

export function CheckRemoteVersionsDialog({
  template,
  open,
  onOpenChange,
  onImported,
}: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RemoteCheckResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Eine Zeile pro Kandidat. ``code`` ist gesetzt, wenn ein strukturierter
  // Backend-Fehler kam — daraus rendern wir kandidaten-spezifische Action-
  // Buttons (z.B. „Im Repo bumpen", „Bestehende Version ersetzen").
  const [importLog, setImportLog] = useState<
    Array<{
      label: string;
      ok: boolean;
      message?: string;
      code?: VersionErrorCode | null;
      details?: Record<string, unknown> | null;
    }>
  >([]);
  // Pro Kandidat-SHA gemerkt: „der Owner hat hier schon einen Replace
  // ausgelöst", damit wir doppelte Auslöser unterbinden und State zwischen
  // Render-Pässen halten.
  const [replacing, setReplacing] = useState<Set<string>>(new Set());

  // Wenn der Dialog frisch öffnet: alles zurücksetzen und sofort einen
  // Check anstoßen. Das spart dem User einen Klick — der Button heißt
  // „Neue Versionen importieren", die Prüfung gehört zum ersten Schritt.
  useEffect(() => {
    if (!open) return;
    setStep("idle");
    setError(null);
    setResult(null);
    setSelected(new Set());
    setImportLog([]);
    setReplacing(new Set());
    void runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const existingShas = new Set(
    (template.versions ?? []).map((v) => v.git_commit_sha).filter(Boolean),
  );

  const runCheck = async () => {
    setStep("checking");
    setError(null);
    try {
      const r = await fetchRemoteCandidates(template.repo_url, existingShas);
      setResult(r);
      // Default-Auswahl: alle Tags ankreuzen, HEAD bewusst NICHT — Tags sind
      // die expliziter gemeinte Veröffentlichung; HEAD ist „aktueller Stand
      // auf dem Branch" und sollte eine bewusste Entscheidung sein.
      const next = new Set<string>();
      r.candidates.forEach((c) => {
        if (c.kind === "tag") next.add(c.commit_sha);
      });
      setSelected(next);
      setStep("select");
    } catch (err) {
      if (err instanceof RemoteCheckError) {
        const messages: Record<string, string> = {
          not_found:
            "Das Repository ist über die anonyme GitHub-API nicht erreichbar. Falls es privat ist, kann das Frontend ohne ein Backend-Token nicht remote prüfen — du kannst eine neue Version aber weiterhin manuell importieren lassen.",
          rate_limited:
            "GitHub-API-Rate-Limit erreicht (60 Anfragen/Stunde anonym). Bitte später erneut versuchen.",
          parse: `Die hinterlegte Repo-URL ist nicht parsbar: ${err.message}`,
          network: "Netzwerkfehler beim Aufruf der GitHub-API.",
          unknown: err.message,
        };
        setError(messages[err.kind] ?? err.message);
      } else {
        setError(err instanceof Error ? err.message : "Prüfung fehlgeschlagen.");
      }
      setStep("idle");
    }
  };

  const toggle = (sha: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sha)) next.delete(sha);
      else next.add(sha);
      return next;
    });
  };

  const selectedCandidates = (result?.candidates ?? []).filter((c) =>
    selected.has(c.commit_sha),
  );

  const runImport = async () => {
    if (!result || selectedCandidates.length === 0) return;
    setStep("importing");
    setImportLog([]);

    const log: typeof importLog = [];
    for (const cand of selectedCandidates) {
      const entry = await importOne(cand, { replace_existing: false });
      log.push(entry);
      setImportLog([...log]);
    }

    summariseToast(log);
    setStep("done");
    onImported();
  };

  /**
   * Importiert einen einzelnen Kandidaten und gibt das Log-Entry zurück.
   * Wird sowohl vom batch-runImport als auch vom Replace-Retry verwendet.
   */
  const importOne = async (
    cand: RemoteCandidate,
    opts: { replace_existing: boolean },
  ): Promise<(typeof importLog)[number]> => {
    if (!result) {
      return { label: cand.label, ok: false, message: "Kein Repo-Kontext." };
    }
    try {
      const url = buildGithubUrl({
        owner: result.parsed.owner,
        repo: result.parsed.repo,
        ref: cand.ref_for_import,
        path: result.parsed.path,
      });
      await importTemplateVersionFromGithub(template.id, {
        github_url: url,
        app_yaml_path: null,
        is_active: false,
        replace_existing: opts.replace_existing,
      });
      return { label: cand.label, ok: true };
    } catch (err) {
      if (err instanceof ApiError) {
        return {
          label: cand.label,
          ok: false,
          message: err.message,
          code: err.code as VersionErrorCode | null,
          details: err.details,
        };
      }
      return {
        label: cand.label,
        ok: false,
        message: err instanceof Error ? err.message : "Import fehlgeschlagen.",
      };
    }
  };

  const summariseToast = (log: typeof importLog) => {
    const successes = log.filter((l) => l.ok).length;
    const failures = log.length - successes;
    if (failures === 0) {
      toast.success(
        successes === 1
          ? "Version importiert."
          : `${successes} Versionen importiert.`,
      );
    } else if (successes === 0) {
      toast.error("Kein Import erfolgreich. Details unten im Dialog.");
    } else {
      toast.error(`${successes} von ${log.length} Versionen importiert.`);
    }
  };

  /**
   * „Bestehende Version ersetzen" für einen einzelnen Kandidaten.
   * Frage den Owner explizit, weil dabei die alte Version-Row inkl. Files
   * gelöscht wird. Backend lehnt zusätzlich ab, wenn aktive Deployments
   * an der alten Row hängen — wir surface die Meldung dann hier.
   */
  const handleReplace = async (cand: RemoteCandidate) => {
    if (replacing.has(cand.commit_sha)) return;
    const ok = window.confirm(
      `Die bestehende Version ${cand.label} im Template wird inkl. ihrer `
        + `Dateien überschrieben. Diese Aktion lässt sich nicht rückgängig `
        + `machen. Fortfahren?`,
    );
    if (!ok) return;
    setReplacing((prev) => new Set(prev).add(cand.commit_sha));
    const next = await importOne(cand, { replace_existing: true });
    setImportLog((prev) => {
      const updated = prev.map((e) => (e.label === cand.label ? next : e));
      // Erstes Replace pro Kandidat: wenn der Owner direkt nach dem Initial-
      // Import auf Replace klickt, gibt es noch kein Log-Entry → einfügen.
      return updated.some((e) => e.label === cand.label)
        ? updated
        : [...updated, next];
    });
    setReplacing((prev) => {
      const updated = new Set(prev);
      updated.delete(cand.commit_sha);
      return updated;
    });
    if (next.ok) {
      toast.success(`Version ${cand.label} ersetzt.`);
      onImported();
    } else {
      toast.error(`Replace fehlgeschlagen: ${next.message ?? ""}`);
    }
  };

  // ---------- Rendering pro Step -----------------------------------------

  const renderCheckingState = () => (
    <div className="flex items-center gap-3 py-8 justify-center text-slate-600">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>Suche neuere Versionen auf GitHub…</span>
    </div>
  );

  const renderSelect = () => {
    if (!result) return null;
    if (result.candidates.length === 0) {
      return (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 text-sm">
            Keine neuen Versionen gefunden. Das Template ist auf dem Stand des
            Repositories.
          </AlertDescription>
        </Alert>
      );
    }
    return (
      <>
        <p className="text-sm text-slate-600">
          {result.candidates.length}{" "}
          {result.candidates.length === 1 ? "neue Version" : "neue Versionen"}{" "}
          gefunden, die noch nicht importiert sind. Wähle aus, welche
          übernommen werden sollen.
        </p>
        <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {result.candidates.map((c) => (
            <li key={c.commit_sha}>
              <Label
                htmlFor={`rc-${c.commit_sha}`}
                className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-slate-50 cursor-pointer"
              >
                <Checkbox
                  id={`rc-${c.commit_sha}`}
                  checked={selected.has(c.commit_sha)}
                  onCheckedChange={() => toggle(c.commit_sha)}
                  className="mt-1"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.kind === "tag" ? (
                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                        <Tag className="w-3 h-3 mr-1" />
                        Tag
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200">
                        <GitBranch className="w-3 h-3 mr-1" />
                        Branch-HEAD
                      </Badge>
                    )}
                    <span className="font-medium text-slate-900">{c.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 font-mono break-all">
                    {c.commit_sha.slice(0, 12)}
                  </p>
                  {c.committed_at && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(c.committed_at).toLocaleString("de-DE")}
                    </p>
                  )}
                </div>
              </Label>
            </li>
          ))}
        </ul>
      </>
    );
  };

  const renderConfirm = () => (
    <div className="space-y-3">
      <p className="text-sm text-slate-900">
        {selectedCandidates.length === 1 ? (
          <>Eine Version wird aus GitHub importiert:</>
        ) : (
          <>{selectedCandidates.length} Versionen werden aus GitHub importiert:</>
        )}
      </p>
      <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
        {selectedCandidates.map((c) => (
          <li
            key={c.commit_sha}
            className="text-sm text-slate-700 flex items-center gap-2"
          >
            {c.kind === "tag" ? (
              <Tag className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            ) : (
              <GitBranch className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
            <span className="font-medium">{c.label}</span>
            <span className="text-xs font-mono text-slate-500">
              {c.commit_sha.slice(0, 7)}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        Die importierten Versionen landen zunächst inaktiv und warten je nach
        Admin-Regel auf Approval. Aktivieren kannst du sie anschließend über
        „Aktive Version ändern".
      </p>
    </div>
  );

  const renderImportingOrDone = () => (
    <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {selectedCandidates.map((cand) => {
        const entry = importLog.find((l) => l.label === cand.label);
        const isPending = !entry;
        const isReplacing = replacing.has(cand.commit_sha);
        return (
          <li
            key={cand.commit_sha}
            className="flex flex-col gap-2 p-2.5 rounded-lg border border-slate-200"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {(isPending && step === "importing") || isReplacing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                ) : entry?.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-900 flex items-center gap-2">
                  {cand.kind === "tag" ? (
                    <Tag className="w-3 h-3 text-blue-600" />
                  ) : (
                    <GitBranch className="w-3 h-3 text-slate-500" />
                  )}
                  {cand.label}
                  <span className="text-xs font-mono text-slate-500">
                    {cand.commit_sha.slice(0, 7)}
                  </span>
                </p>
                {entry?.message && (
                  <p className="text-xs text-red-700 mt-1">{entry.message}</p>
                )}
              </div>
            </div>
            {/* Aktion-Buttons bei strukturierten Versions-Fehlern.
                MISSING / NOT_SEMVER / NOT_STRICTLY_GREATER → „Im Repo
                bumpen" öffnet die app.yaml im GitHub-Editor.
                ALREADY_EXISTS → zusätzlich „Bestehende Version ersetzen"
                (Confirm + Backend-Replace-Pfad). */}
            {entry && !entry.ok && entry.code && (
              <CandidateActions
                cand={cand}
                code={entry.code}
                disabled={isReplacing}
                onReplace={() => void handleReplace(cand)}
                appYamlPath={
                  result?.parsed.path
                    ? endsInYaml(result.parsed.path)
                      ? result.parsed.path
                      : `${result.parsed.path.replace(/\/$/, "")}/app.yaml`
                    : "app.yaml"
                }
                editUrl={
                  result
                    ? buildGithubEditUrl({
                        owner: result.parsed.owner,
                        repo: result.parsed.repo,
                        ref: cand.ref_for_import,
                        path: endsInYaml(result.parsed.path ?? "")
                          ? (result.parsed.path as string)
                          : `${(result.parsed.path ?? "").replace(/\/$/, "")}/app.yaml`,
                      })
                    : null
                }
              />
            )}
          </li>
        );
      })}
    </ul>
  );

  // ---------- Footer-Buttons pro Step ------------------------------------

  const renderFooter = () => {
    if (step === "checking") {
      return (
        <DialogFooter>
          <Button variant="outline" disabled>
            Bitte warten…
          </Button>
        </DialogFooter>
      );
    }

    if (step === "select") {
      const hasCandidates = (result?.candidates.length ?? 0) > 0;
      return (
        <DialogFooter className="flex-row justify-between gap-2">
          <Button variant="outline" size="sm" onClick={runCheck}>
            <RefreshCcw className="w-4 h-4 mr-2" />
            Erneut prüfen
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Schließen
            </Button>
            <Button
              className="bg-teal-500 hover:bg-teal-600 text-white"
              disabled={!hasCandidates || selected.size === 0}
              onClick={() => setStep("confirm")}
            >
              <Download className="w-4 h-4 mr-2" />
              {selected.size > 0
                ? `${selected.size} importieren`
                : "Importieren"}
            </Button>
          </div>
        </DialogFooter>
      );
    }

    if (step === "confirm") {
      return (
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => setStep("select")}>
            Zurück
          </Button>
          <Button
            className="bg-teal-500 hover:bg-teal-600 text-white"
            onClick={runImport}
          >
            <Download className="w-4 h-4 mr-2" />
            Import bestätigen
          </Button>
        </DialogFooter>
      );
    }

    if (step === "importing") {
      return (
        <DialogFooter>
          <Button variant="outline" disabled>
            Wird importiert…
          </Button>
        </DialogFooter>
      );
    }

    // "done" und "idle"
    return (
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Schließen
        </Button>
      </DialogFooter>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            Neue Versionen importieren
          </DialogTitle>
          <DialogDescription>
            Prüft das verknüpfte Repository auf Tags und Commits, die noch
            nicht als Template-Version vorliegen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {error && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {step === "checking" && renderCheckingState()}
          {step === "select" && renderSelect()}
          {step === "confirm" && renderConfirm()}
          {(step === "importing" || step === "done") && renderImportingOrDone()}
        </div>

        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function endsInYaml(path: string): boolean {
  return path.endsWith(".yaml") || path.endsWith(".yml");
}

/**
 * Aktion-Buttons unterhalb eines fehlgeschlagenen Kandidaten:
 * - „Im Repo bumpen" öffnet die app.yaml im GitHub-Web-Editor in einem
 *   neuen Tab — der Owner kann dort `app.version` setzen und neu importieren.
 * - „Bestehende Version ersetzen" erscheint nur bei
 *   ``VERSION_ALREADY_EXISTS`` und triggert den Replace-Pfad mit Confirm.
 */
function CandidateActions({
  cand,
  code,
  appYamlPath,
  editUrl,
  disabled,
  onReplace,
}: {
  cand: RemoteCandidate;
  code: VersionErrorCode;
  appYamlPath: string;
  editUrl: string | null;
  disabled: boolean;
  onReplace: () => void;
}) {
  const showReplace = code === VERSION_ERROR_CODES.ALREADY_EXISTS;
  const showBump =
    code === VERSION_ERROR_CODES.ALREADY_EXISTS
    || code === VERSION_ERROR_CODES.NOT_STRICTLY_GREATER
    || code === VERSION_ERROR_CODES.MISSING_IN_MANIFEST
    || code === VERSION_ERROR_CODES.NOT_SEMVER;
  if (!showBump && !showReplace) return null;
  return (
    <div className="flex flex-wrap gap-2 pl-7">
      {showBump && editUrl && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(editUrl, "_blank", "noopener,noreferrer")}
          className="h-7 text-xs"
          title={`${appYamlPath} im GitHub-Editor öffnen`}
        >
          <ExternalLink className="w-3 h-3 mr-1.5" />
          Im Repo bumpen
        </Button>
      )}
      {showReplace && (
        <Button
          size="sm"
          variant="outline"
          onClick={onReplace}
          disabled={disabled}
          className="h-7 text-xs"
          title={`Bestehende Version ${cand.label} im Template ersetzen`}
        >
          <Replace className="w-3 h-3 mr-1.5" />
          Bestehende Version ersetzen
        </Button>
      )}
    </div>
  );
}
