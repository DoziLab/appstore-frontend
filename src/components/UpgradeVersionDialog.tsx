// „Aktive Version ändern" — Auswahl- und Bestätigungsdialog: der Owner
// wählt eine bereits importierte Version (auch ältere!), das Backend setzt
// sie via POST /api/v1/template-versions/{id}/activate als aktiv und
// deaktiviert dabei automatisch die bisherige Aktive. Approval ist hier
// kein Faktor — inaktive Versionen können den Status `pending`/`approved`/
// `rejected` haben; das wird zur Information angezeigt, blockiert die
// Aktivierung aber nicht.
//
// Downgrade-Hinweis: bewusst keine Strictly-Newer-Sperre. Wenn die jüngste
// Version z.B. einen Bug hat, soll der Owner zurück auf eine ältere
// Version wechseln können. Backend (`activate_version` +
// `deactivate_other_versions`) erlaubt das atomar.
//
// Die Vorauswahl der Kandidaten macht der Aufrufer in
// TemplateOwnerDetailDialog; hier kommt nur die fertige Liste an. Aktive
// Version wird vom Aufrufer aus der Liste ausgeschlossen.

import { useEffect, useState } from "react";
import { ArrowLeftRight, GitBranch } from "lucide-react";
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

export function ChangeActiveVersionDialog({
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
      toast.success("Aktive Version geändert.");
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
            <ArrowLeftRight className="w-5 h-5 text-teal-600" />
            Aktive Version ändern
          </DialogTitle>
          <DialogDescription>
            Wähle die Version, die im Deployment-Wizard vorausgewählt werden
            soll. Du kannst auch zu einer älteren Version wechseln —
            Downgrades sind erlaubt.
          </DialogDescription>
        </DialogHeader>

        {activeVersion && (
          <div className="text-xs text-slate-500 -mt-1 mb-2">
            Aktuell aktiv: <Badge variant="outline">{activeVersion.version}</Badge>
          </div>
        )}

        {candidates.length === 0 ? (
          <p className="text-sm text-slate-500 italic">
            Es gibt keine weitere Version, die du aktivieren könntest.
            Importiere zunächst eine neue Version aus dem verknüpften
            Repository.
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
            {busy ? "Wird aktiviert…" : "Als aktiv setzen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Backwards-compat alias: andere Imports referenzieren ggf. noch den alten
// Namen. Wenn alle Aufrufer umgezogen sind, kann dieser Re-Export raus.
export { ChangeActiveVersionDialog as UpgradeVersionDialog };
