// Auswahl- und Bestätigungsdialog für „Aktualisieren": der Owner wählt eine
// strikt neuere, bereits importierte Version, das Backend setzt sie via
// POST /api/v1/template-versions/{id}/activate als aktiv (und deaktiviert
// dabei automatisch die bisherige Aktive). Approval ist hier kein Faktor —
// inaktive Versionen können den Status `pending`/`approved`/`rejected` haben;
// das wird zur Information angezeigt, blockiert die Aktivierung aber nicht.
//
// Die Vorauswahl der Kandidaten (Downgrade-Filter) macht der Aufrufer in
// TemplateOwnerDetailDialog; hier kommt nur die fertige Liste an.

import { useEffect, useState } from "react";
import { ArrowUpCircle, GitBranch } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { ApprovalBadge } from "./ApprovalBadge";
import { activateTemplateVersion, type TemplateVersionDto } from "../api/templates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: TemplateVersionDto[];
  activeVersion: TemplateVersionDto | null;
  onActivated: () => void;
}

export function UpgradeVersionDialog({
  open,
  onOpenChange,
  candidates,
  activeVersion,
  onActivated,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Auswahl zurücksetzen, sobald sich die Kandidatenliste ändert oder der
  // Dialog frisch geöffnet wird — sonst zeigt der RadioGroup eine veraltete ID.
  useEffect(() => {
    if (open) setSelected(candidates[0]?.id ?? null);
  }, [open, candidates]);

  const handleActivate = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await activateTemplateVersion(selected);
      toast.success("Version aktiviert.");
      onActivated();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Aktivierung fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5 text-teal-600" />
            Auf neuere Version aktualisieren
          </DialogTitle>
          <DialogDescription>
            Wähle eine bereits importierte, neuere Version. Downgrades sind
            nicht möglich.
          </DialogDescription>
        </DialogHeader>

        {activeVersion && (
          <div className="text-xs text-slate-500 -mt-1 mb-2">
            Aktuell aktiv: <Badge variant="outline">{activeVersion.version}</Badge>
          </div>
        )}

        {candidates.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            Keine neuere Version verfügbar. Importiere zunächst eine neue
            Version aus dem verknüpften Repository.
          </p>
        ) : (
          <RadioGroup
            value={selected ?? ""}
            onValueChange={setSelected}
            className="space-y-2 max-h-72 overflow-y-auto pr-1"
          >
            {candidates.map((v) => {
              return (
                <Label
                  key={v.id}
                  htmlFor={`upg-${v.id}`}
                  className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-slate-50 cursor-pointer"
                >
                  <RadioGroupItem value={v.id} id={`upg-${v.id}`} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{v.version}</Badge>
                      <ApprovalBadge status={v.approval_status} variant="version" />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-mono break-all">
                      <GitBranch className="w-3 h-3 inline mr-1" />
                      {v.git_commit_sha}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(v.created_at).toLocaleString("de-DE")}
                    </p>
                  </div>
                </Label>
              );
            })}
          </RadioGroup>
        )}

        <DialogFooter className="flex-row justify-end gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            className="bg-teal-500 hover:bg-teal-600 text-white"
            onClick={handleActivate}
            disabled={!selected || busy || candidates.length === 0}
          >
            {busy ? "Wird aktiviert…" : "Aktivieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
