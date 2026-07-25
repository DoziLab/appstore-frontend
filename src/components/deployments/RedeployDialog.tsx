// Redeploy-Dialog für Issue #192 — destroy+recreate eines gesamten Deployments
// oder einer einzelnen VM, mit optionalem Config-Override und einem Toggle für
// preserve_credentials.
//
// Wichtig fürs Framing: Ein Redeploy SPEICHERT keine Config, sondern BAUT NEU AUF.
// Die hier geänderten Parameter werden nur für genau diesen Redeploy-Lauf
// angewendet (das Backend schreibt sie nicht dauerhaft in deployment_parameters
// zurück). Der Dialog-Text macht das explizit.
//
// Feld-Rendering ist bewusst an DeploymentWizard.renderParameterField angelehnt
// (boolean → Switch, number → Input[number], sonst Text). Wir haben hier aber
// keine TemplateParameter-Definitionen zur Hand — nur die gespeicherten
// Key/Value-Paare aus deployment_parameters.parameters. Den Feldtyp leiten wir
// daher aus `typeof value` ab. Nur tatsächlich geänderte Keys werden als Override
// gesendet (Diff gegen die Startwerte); unveränderte Config → leeres Objekt =
// "unverändert übernehmen".
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner@2.0.3";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { Checkbox } from "../ui/checkbox";
import {
  redeployDeployment,
  redeployInstance,
  type RedeployRequest,
} from "../../api/deployments";

export type RedeployTarget =
  | { kind: "deployment" }
  | { kind: "instance"; instanceId: string; vmName: string };

export interface RedeployDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deploymentId: string;
  /** Zielobjekt: ganzes Deployment oder eine einzelne VM. */
  target: RedeployTarget;
  /**
   * Aktuelle Config-Parameter (aus deployment.deploymentParameters.parameters).
   * Dienen als editierbare Startwerte. Leer/undefined → nur der
   * preserve_credentials-Toggle wird angezeigt.
   */
  currentParameters?: Record<string, any>;
  openstackProjectId: string | null;
  /** Wird nach erfolgreichem 202 aufgerufen (z.B. Detailseite neu laden). */
  onRedeployed?: () => void;
}

// Feldtyp aus dem gespeicherten Wert ableiten — wir haben hier keine
// TemplateParameter-Metadaten.
type FieldType = "boolean" | "number" | "text";
function inferType(value: any): FieldType {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  return "text";
}

function humanizeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function RedeployDialog({
  open,
  onOpenChange,
  deploymentId,
  target,
  currentParameters,
  openstackProjectId,
  onRedeployed,
}: RedeployDialogProps) {
  // Startwerte einfrieren, sobald der Dialog aufgeht — der Diff beim Absenden
  // vergleicht dagegen.
  const initialParams = useMemo(
    () => currentParameters ?? {},
    [currentParameters],
  );
  const paramKeys = useMemo(() => Object.keys(initialParams), [initialParams]);

  const [values, setValues] = useState<Record<string, any>>(initialParams);
  const [preserveCredentials, setPreserveCredentials] = useState(true);
  const [inFlight, setInFlight] = useState(false);

  // Bei jedem Öffnen die Formularwerte auf den aktuellen Stand zurücksetzen.
  useEffect(() => {
    if (open) {
      setValues(initialParams);
      setPreserveCredentials(true);
      setInFlight(false);
    }
  }, [open, initialParams]);

  const isInstance = target.kind === "instance";
  const titleTarget = isInstance ? `VM „${target.vmName}"` : "Deployment";

  const handleValueChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  // Nur geänderte Keys als Override — unveränderte Config fällt backend-seitig
  // auf die gespeicherten Werte zurück.
  const buildOverrides = (): Record<string, any> => {
    const overrides: Record<string, any> = {};
    for (const key of paramKeys) {
      if (values[key] !== initialParams[key]) {
        overrides[key] = values[key];
      }
    }
    return overrides;
  };

  const handleSubmit = async () => {
    if (inFlight) return;
    setInFlight(true);

    const overrides = buildOverrides();
    // Für beide Endpoints wandert der Override in deployment_parameter_overrides:
    // beim per-Instanz-Endpoint IST das der volle Override für diese eine VM
    // (instance_parameter_overrides wird dort ignoriert).
    const body: RedeployRequest = {
      deployment_parameter_overrides: overrides,
      preserve_credentials: preserveCredentials,
    };

    try {
      if (isInstance) {
        await redeployInstance(deploymentId, target.instanceId, body, openstackProjectId);
        toast.success(`Redeploy für VM „${target.vmName}" gestartet.`);
      } else {
        await redeployDeployment(deploymentId, body, openstackProjectId);
        toast.success("Redeploy für das Deployment gestartet.");
      }
      onOpenChange(false);
      onRedeployed?.();
    } catch (err) {
      const e = err as Error & { status?: number };
      // 400 = bereits ein Redeploy in Arbeit (Race-Schutz im Backend).
      if (e.status === 400) {
        toast.error(
          "Es läuft bereits ein Redeploy für dieses Deployment. Bitte warten, bis er abgeschlossen ist.",
        );
      } else if (e.status === 403) {
        toast.error("Keine Berechtigung für diesen Redeploy.");
      } else if (e.status === 404) {
        toast.error("Deployment oder VM nicht gefunden. Bitte Seite neu laden.");
      } else {
        toast.error("Redeploy konnte nicht gestartet werden. Bitte erneut versuchen.");
      }
      console.error("redeploy failed", err);
    } finally {
      setInFlight(false);
    }
  };

  const renderField = (key: string) => {
    const type = inferType(initialParams[key]);
    const value = values[key];
    const fieldId = `redeploy-param-${key}`;

    if (type === "boolean") {
      return (
        <div
          key={key}
          className="flex items-center justify-between p-3 rounded-lg bg-slate-50"
        >
          <Label htmlFor={fieldId} className="flex-1">
            {humanizeKey(key)}
          </Label>
          <Switch
            id={fieldId}
            checked={value === true || value === "true" || value === 1 || value === "1"}
            onCheckedChange={(checked: boolean) => handleValueChange(key, checked)}
          />
        </div>
      );
    }

    if (type === "number") {
      return (
        <div key={key} className="space-y-2">
          <Label htmlFor={fieldId}>{humanizeKey(key)}</Label>
          <Input
            id={fieldId}
            type="number"
            value={value ?? ""}
            onChange={(e) => {
              if (!e.target.value) {
                handleValueChange(key, "");
                return;
              }
              const next = Number(e.target.value);
              handleValueChange(key, Number.isNaN(next) ? "" : next);
            }}
          />
        </div>
      );
    }

    return (
      <div key={key} className="space-y-2">
        <Label htmlFor={fieldId}>{humanizeKey(key)}</Label>
        <Input
          id={fieldId}
          type="text"
          value={value ?? ""}
          onChange={(e) => handleValueChange(key, e.target.value)}
        />
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-slate-600" />
            {titleTarget} neu deployen
          </DialogTitle>
          <DialogDescription>
            {isInstance
              ? `Die VM „${target.vmName}" wird zerstört und neu aufgebaut. Andere VMs des Deployments bleiben unberührt.`
              : "Alle VMs dieses Deployments werden nacheinander zerstört und neu aufgebaut."}{" "}
            Änderungen an der Konfiguration werden nur für diesen Redeploy angewendet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2 overflow-y-auto flex-1">
          {paramKeys.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-900">Konfiguration</h4>
              {paramKeys.map((key) => renderField(key))}
            </div>
          )}

          <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
            <Checkbox
              id="redeploy-preserve-credentials"
              checked={preserveCredentials}
              onCheckedChange={(checked) => setPreserveCredentials(checked === true)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="redeploy-preserve-credentials" className="cursor-pointer">
                Zugangsdaten beibehalten
              </Label>
              <p className="text-xs text-slate-500 mt-1">
                Bestehende Passwörter, SSH-Keys und Aktivierungslinks bleiben gültig.
                Deaktivieren, um beim Redeploy frische Zugangsdaten zu erzeugen.
              </p>
            </div>
          </div>

          {!preserveCredentials && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Ohne „Zugangsdaten beibehalten" werden neue Passwörter und SSH-Keys
                generiert — bestehende Studenten-Logins funktionieren danach nicht mehr.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={inFlight}>
            Abbrechen
          </Button>
          <Button onClick={handleSubmit} disabled={inFlight}>
            {inFlight ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Wird gestartet…
              </>
            ) : (
              "Neu deployen"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
