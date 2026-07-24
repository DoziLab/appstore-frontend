// Bestätigungs-Dialog vor dem Cascade-Delete eines Lecturer-Accounts.
//
// Der Delete ist unwiderruflich und löscht cascading:
//   • alle Deployments des Users (inkl. Heat-Stacks in OpenStack)
//   • alle Templates + Versionen
//   • alle OpenStack-Projekt-Rows (nur unsere DB — nicht Keystone!)
//   • zuletzt den User-Row selbst
// Deshalb typische destruktive-Aktion-UX: der Admin muss den Namen (oder
// den Username / die Email — Fallback in dieser Reihenfolge) des Users
// exakt eintippen, bevor der Button aktiv wird.
//
// Der Backend-Delete ist asynchron (202 + Celery-Task-ID). Erfolg wird
// deshalb NICHT hier detektiert — dieser Dialog schließt lediglich sobald
// der 202 zurückkommt. Das Polling passiert im aufrufenden Detail-View.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner@2.0.3";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { deleteLecturer, type LecturerDetail } from "../api/lecturers";
import { ApiError } from "../api/http";

interface Props {
  lecturer: LecturerDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback nach 202 Accepted — der aufrufende Detail-View startet dann
   *  das Polling. Bekommt die Task-ID mit, damit man sie z.B. für einen
   *  Toast oder späteren Debug-Log verwenden könnte. */
  onDeleteEnqueued: (taskId: string) => void;
}

export function DeleteLecturerConfirmDialog({
  lecturer,
  open,
  onOpenChange,
  onDeleteEnqueued,
}: Props) {
  const [typedName, setTypedName] = useState("");
  const [busy, setBusy] = useState(false);

  // Was muss der Admin abtippen? display_name ist der bevorzugte Wert, weil
  // er in der Tabelle auch groß angezeigt wird. Fallback in derselben
  // Reihenfolge wie im Rest des UIs — sonst wären User ohne
  // Display-Name/Username nicht löschbar.
  const expected = useMemo(
    () =>
      lecturer.display_name?.trim() ||
      lecturer.username?.trim() ||
      lecturer.email?.trim() ||
      lecturer.id,
    [lecturer],
  );

  // Beim Öffnen/Schließen den Zustand zurücksetzen, damit ein zweiter Delete
  // nicht mit halb-getipptem Namen startet.
  useEffect(() => {
    if (open) {
      setTypedName("");
      setBusy(false);
    }
  }, [open, lecturer.id]);

  const nameMatches = typedName.trim() === expected;
  const canDelete = nameMatches && !busy;

  const handleDelete = async () => {
    if (!canDelete) return;
    setBusy(true);
    try {
      const resp = await deleteLecturer(lecturer.id);
      onDeleteEnqueued(resp.data.task_id);
      onOpenChange(false);
    } catch (err) {
      // Häufigste Fehlerfälle laut Backend: 400 (Admin löscht sich selbst),
      // 404 (User ist kein Lecturer mehr — z.B. wenn parallel schon
      // gelöscht). Beide sind für den Admin über die Message klar genug.
      const message =
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Löschen konnte nicht ausgelöst werden.";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            Lecturer-Account löschen?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              <p>
                Dies wird <span className="font-semibold">permanent</span> die
                folgenden Ressourcen von{" "}
                <span className="font-semibold">{expected}</span> entfernen:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  <span className="font-semibold">
                    {lecturer.deployment_count}
                  </span>{" "}
                  Deployment
                  {lecturer.deployment_count === 1 ? "" : "s"} (inkl.
                  Heat-Stacks in OpenStack)
                </li>
                <li>
                  <span className="font-semibold">
                    {lecturer.template_count}
                  </span>{" "}
                  Template
                  {lecturer.template_count === 1 ? "" : "s"} mit allen Versionen
                </li>
                <li>
                  <span className="font-semibold">
                    {lecturer.openstack_project_count}
                  </span>{" "}
                  OpenStack-Projekt
                  {lecturer.openstack_project_count === 1 ? "" : "e"} (nur
                  DB-Zeile, das Projekt bleibt in Keystone)
                </li>
              </ul>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
                <p className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  Kein Keycloak-Sync
                </p>
                <p className="mt-1">
                  Der Keycloak-Account bleibt bestehen und kann sich weiter
                  einloggen — er wird beim nächsten Login als leerer User neu
                  angelegt.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="lecturer-confirm-name" className="text-sm">
            Zur Bestätigung <span className="font-semibold">{expected}</span>{" "}
            eintippen:
          </Label>
          <Input
            id="lecturer-confirm-name"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={expected}
            autoComplete="off"
            autoFocus
            disabled={busy}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // Radix schließt den Dialog per Default beim Click auf Action —
              // wir wollen bei Fehlern (z.B. 400) offen bleiben und den Toast
              // sichtbar lassen. handleDelete schließt selbst bei Erfolg.
              e.preventDefault();
              void handleDelete();
            }}
            disabled={!canDelete}
            className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {busy ? "Wird gelöscht…" : "Endgültig löschen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
