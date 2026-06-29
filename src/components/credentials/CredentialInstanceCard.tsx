// Gemeinsamer Credentials-Renderer für Lecturer- und Student-Views.
//
// Hintergrund: Dasselbe Tab/Accordion/Copy/Mask-Layout wurde früher inline in
// DeploymentDetails gehalten — wir teilen es jetzt, damit
// StudentDeploymentDetails dieselbe UI bekommt, ohne ~350 Zeilen zu
// duplizieren.
//
// Zwei Modes:
//  - "lecturer": zeigt zwei Tabs (Dozent / Gruppen). Dozent-Tab listet alle
//    Accesses mit group_id == null, Gruppen-Tab gruppiert nach group_name.
//    SSH-Keys werden aus dem eingebetteten ssh_private_key-Feld geladen
//    (kein dedizierter Endpoint nötig).
//  - "student": nur ein Gruppen-Accordion (Backend filtert Dozent-Rows
//    sowieso raus; wir bleiben defensiv und erwarten group_id != null in
//    allen rows). SSH-Key-Download geht über onDownloadSshKey-Prop, die
//    den dedizierten /access/{id}/ssh-key-Endpoint anstößt.
import { useState } from "react";
import { Copy, Download, Eye, EyeOff, Key, Loader2, ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import type {
  CredentialAccess,
  CredentialInstance,
} from "../../api/deployments";

const accessTypeLabels: Record<string, string> = {
  ssh: "SSH",
  web_url: "Web URL",
  guacamole: "Guacamole",
  rdp: "RDP",
  vnc: "VNC",
  database: "Database",
  // Einmaliger Setup-Link, den das Playbook auf der VM erzeugt (z.B.
  // Overleaf-CLI). Keine Passwort-Zeile, klickbarer Link im Verbindungs-
  // Feld — siehe AccessRow weiter unten.
  activation_link: "Aktivierungslink",
};

export type CredentialsMode = "lecturer" | "student";

export interface CredentialInstanceCardProps {
  instance: CredentialInstance;
  mode: CredentialsMode;
  passwordVisibility: Record<string, boolean>;
  togglePasswordVisibility: (key: string) => void;
  handleCopy: (value: string | null | undefined, label: string) => void;
  getMaskedPassword: (pw: string | null | undefined) => string;
  /**
   * Optional. Wenn gesetzt, erscheint pro SSH-Access ein Download-Button,
   * der die Funktion mit (accessId, username) aufruft. Im Student-Mode
   * unbedingt setzen — dort gibt's keinen eingebetteten ssh_private_key
   * im Bundle-Download, der dedizierte Endpoint ist der einzige Pfad.
   *
   * Im Lecturer-Mode ebenfalls setzen, sobald wir den `/access/{id}/ssh-key`-
   * Endpoint nutzen wollen — er liefert den PEM-Body via Browser-Download
   * statt über das eingebettete Feld. Inline-Anzeige + Copy funktionieren
   * unabhängig vom Handler (greifen direkt auf `access.ssh_private_key`).
   *
   * Darf eine `Promise` zurückgeben — die Row zeigt während des Requests
   * einen Spinner, damit der Nutzer keinen Doppelklick auslöst.
   */
  onDownloadSshKey?: (
    accessId: string,
    username: string | null,
  ) => void | Promise<void>;
  /**
   * Username des eingeloggten Lecturers (Keycloak `preferred_username`).
   * Wird als Heuristik für „dies ist der Admin-Zugang" verwendet — das
   * Backend liefert (noch) kein explizites `is_admin`-Flag, also matchen
   * wir case-insensitive gegen `access.username`. Im Student-Mode irrelevant.
   */
  currentUsername?: string | null;
}

export function CredentialInstanceCard({
  instance,
  mode,
  passwordVisibility,
  togglePasswordVisibility,
  handleCopy,
  getMaskedPassword,
  onDownloadSshKey,
  currentUsername,
}: CredentialInstanceCardProps) {
  // Lecturer-View: Dozent-Zeilen (group_id IS NULL) vs. Gruppen-Zeilen.
  // Student-View: alle Zeilen sind Gruppen-Zeilen (Backend filtert NULL aus),
  // wir gruppieren trotzdem nach group_name, um mehrere Gruppen sauber
  // darzustellen — ein Student kann theoretisch in mehreren Gruppen sein.
  const teacherAccesses =
    mode === "lecturer"
      ? instance.accesses.filter((a) => a.group_id == null)
      : [];
  const groupAccesses =
    mode === "lecturer"
      ? instance.accesses.filter((a) => a.group_id != null)
      : instance.accesses;

  const groupsByLabel = new Map<string, CredentialAccess[]>();
  for (const a of groupAccesses) {
    const key = a.group_name || a.group_id || "Gruppe";
    const list = groupsByLabel.get(key) ?? [];
    list.push(a);
    groupsByLabel.set(key, list);
  }

  const defaultTab = teacherAccesses.length > 0 ? "dozent" : "gruppen";

  return (
    <Card className="border-slate-200">
      <CardHeader>
        <CardTitle className="text-base">{instance.vm_name || "VM"}</CardTitle>
        <CardDescription>
          Stack ID: {instance.openstack_stack_id || "-"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/*
          Lecturer-Mode: Tabs (Dozent | Gruppen). Student-Mode: kein Tab
          drumherum, direkt das Accordion — sonst sieht der Student ein
          einsames "Gruppen"-Tab das nichts toggled.
        */}
        {mode === "lecturer" ? (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="mb-4">
              {teacherAccesses.length > 0 && (
                <TabsTrigger value="dozent">
                  Dozent
                  <Badge variant="secondary" className="ml-2">
                    {teacherAccesses.length}
                  </Badge>
                </TabsTrigger>
              )}
              {groupsByLabel.size > 0 && (
                <TabsTrigger value="gruppen">
                  Gruppen
                  <Badge variant="secondary" className="ml-2">
                    {groupsByLabel.size}
                  </Badge>
                </TabsTrigger>
              )}
            </TabsList>

            {teacherAccesses.length > 0 && (
              <TabsContent value="dozent" className="space-y-3">
                {teacherAccesses.map((access, idx) => (
                  <AccessRow
                    key={`teacher-${idx}`}
                    accessKey={`${instance.instance_id}-teacher-${access.access_type}-${idx}`}
                    access={access}
                    passwordVisibility={passwordVisibility}
                    togglePasswordVisibility={togglePasswordVisibility}
                    handleCopy={handleCopy}
                    getMaskedPassword={getMaskedPassword}
                    onDownloadSshKey={onDownloadSshKey}
                    currentUsername={currentUsername}
                  />
                ))}
              </TabsContent>
            )}

            {groupsByLabel.size > 0 && (
              <TabsContent value="gruppen">
                <GroupAccordion
                  groupsByLabel={groupsByLabel}
                  instanceId={instance.instance_id}
                  passwordVisibility={passwordVisibility}
                  togglePasswordVisibility={togglePasswordVisibility}
                  handleCopy={handleCopy}
                  getMaskedPassword={getMaskedPassword}
                  onDownloadSshKey={onDownloadSshKey}
                  currentUsername={currentUsername}
                />
              </TabsContent>
            )}
          </Tabs>
        ) : groupsByLabel.size > 0 ? (
          <GroupAccordion
            groupsByLabel={groupsByLabel}
            instanceId={instance.instance_id}
            passwordVisibility={passwordVisibility}
            togglePasswordVisibility={togglePasswordVisibility}
            handleCopy={handleCopy}
            getMaskedPassword={getMaskedPassword}
            onDownloadSshKey={onDownloadSshKey}
            currentUsername={currentUsername}
          />
        ) : (
          <p className="text-sm text-slate-500">Keine Zugänge verfügbar.</p>
        )}
      </CardContent>
    </Card>
  );
}

function GroupAccordion({
  groupsByLabel,
  instanceId,
  passwordVisibility,
  togglePasswordVisibility,
  handleCopy,
  getMaskedPassword,
  onDownloadSshKey,
  currentUsername,
}: {
  groupsByLabel: Map<string, CredentialAccess[]>;
  instanceId: string;
  passwordVisibility: Record<string, boolean>;
  togglePasswordVisibility: (key: string) => void;
  handleCopy: (value: string | null | undefined, label: string) => void;
  getMaskedPassword: (pw: string | null | undefined) => string;
  onDownloadSshKey?: (
    accessId: string,
    username: string | null,
  ) => void | Promise<void>;
  currentUsername?: string | null;
}) {
  return (
    <Accordion
      type="multiple"
      defaultValue={Array.from(groupsByLabel.keys()).slice(0, 1)}
      className="space-y-2"
    >
      {Array.from(groupsByLabel.entries()).map(([label, accesses]) => (
        <AccordionItem
          key={label}
          value={label}
          className="border border-slate-200 rounded-lg px-3"
        >
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900">{label}</span>
              <Badge variant="outline" className="text-xs">
                {accesses.length} {accesses.length === 1 ? "Zugang" : "Zugänge"}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pt-2">
            {accesses.map((access, idx) => (
              <AccessRow
                key={`${label}-${idx}`}
                accessKey={`${instanceId}-${label}-${access.access_type}-${idx}`}
                access={access}
                passwordVisibility={passwordVisibility}
                togglePasswordVisibility={togglePasswordVisibility}
                handleCopy={handleCopy}
                getMaskedPassword={getMaskedPassword}
                onDownloadSshKey={onDownloadSshKey}
                currentUsername={currentUsername}
              />
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function AccessRow({
  accessKey,
  access,
  passwordVisibility,
  togglePasswordVisibility,
  handleCopy,
  getMaskedPassword,
  onDownloadSshKey,
  currentUsername,
}: {
  accessKey: string;
  access: CredentialAccess;
  passwordVisibility: Record<string, boolean>;
  togglePasswordVisibility: (key: string) => void;
  handleCopy: (value: string | null | undefined, label: string) => void;
  getMaskedPassword: (pw: string | null | undefined) => string;
  onDownloadSshKey?: (
    accessId: string,
    username: string | null,
  ) => void | Promise<void>;
  currentUsername?: string | null;
}) {
  const urlLabel =
    access.access_type === "ssh"
      ? "SSH-Befehl"
      : access.access_type === "web_url"
        ? "URL"
        : access.access_type === "activation_link"
          ? "Aktivierungslink"
          : "Connection URL";

  const isVisible = passwordVisibility[accessKey] === true;

  // Inline-PEM-Anzeige hat einen eigenen Toggle — Standard zugeklappt,
  // weil die meisten Nutzer den Download- oder Copy-Pfad wollen, nicht den
  // rohen Text. State lebt lokal in der Row: kein Parent muss das wissen
  // und es überlebt einen Re-Mount der Card sowieso nicht.
  const [sshKeyVisible, setSshKeyVisible] = useState(false);
  // In-flight-Flag für den Download. Verhindert Doppelklicks und treibt den
  // Loader im Button.
  const [sshDownloading, setSshDownloading] = useState(false);

  // SSH-Key-Block nur zeigen, wenn der Eintrag (a) ein SSH-Access ist und
  // (b) tatsächlich einen PEM trägt. Alte Deployments (vor Feature-Rollout)
  // haben `ssh_private_key === null` und sollen die Sektion gar nicht erst
  // sehen. Eye/Copy hängen am eingebetteten Feld — funktionieren also auch
  // ohne Download-Handler. Der Download-Button braucht zusätzlich eine
  // `access.id` (Backend liefert die seit der Schema-Erweiterung immer mit,
  // aber wir bleiben defensiv).
  const hasPrivateKey =
    access.access_type === "ssh" && !!access.ssh_private_key;
  const canDownloadKey =
    hasPrivateKey && !!onDownloadSshKey && !!access.id;

  // Admin-Heuristik: Der Access-Eintrag, dessen `username` zum eingeloggten
  // Lecturer (Keycloak `preferred_username`) passt, ist der Admin-Zugang.
  // Backend liefert (noch) kein explizites Flag. Case-insensitive, weil
  // Keycloak und OpenStack-User unterschiedliches Casing tragen können.
  const isAdminAccess =
    access.access_type === "ssh" &&
    !!currentUsername &&
    !!access.username &&
    access.username.toLowerCase() === currentUsername.toLowerCase();

  const triggerDownload = async () => {
    if (!onDownloadSshKey || !access.id || sshDownloading) return;
    setSshDownloading(true);
    try {
      await onDownloadSshKey(access.id, access.username);
    } finally {
      setSshDownloading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h4 className="text-sm font-medium text-slate-900">
            {accessTypeLabels[access.access_type] || access.access_type}
          </h4>
          {isAdminAccess && (
            <Badge
              variant="default"
              className="bg-teal-100 text-teal-700 hover:bg-teal-100 gap-1"
              title="Dieser Eintrag ist dein Dozenten-Zugang. SSH-Key gibt dir sudo-Rechte auf der VM."
            >
              <ShieldCheck className="w-3 h-3" />
              Admin
            </Badge>
          )}
        </div>
        <Badge variant="outline">{access.access_type}</Badge>
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">Username</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-900">{access.username ?? "-"}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(access.username, "Username")}
              disabled={!access.username}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {access.access_type !== "activation_link" && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-500">Password</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-900">
                {isVisible
                  ? (access.password ?? "-")
                  : getMaskedPassword(access.password)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => togglePasswordVisibility(accessKey)}
                disabled={!access.password}
              >
                {isVisible ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(access.password, "Password")}
                disabled={!access.password}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">{urlLabel}</span>
          <div className="flex items-center gap-2">
            {access.connection_url ? (
              access.access_type === "web_url" || access.access_type === "activation_link" ? (
                <a
                  href={access.connection_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline break-all"
                >
                  {access.connection_url}
                </a>
              ) : (
                <code className="text-sm bg-slate-100 px-2 py-0.5 rounded break-all font-mono">
                  {access.connection_url}
                </code>
              )
            ) : (
              <span className="text-sm text-slate-400">-</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(access.connection_url, urlLabel)}
              disabled={!access.connection_url}
            >
              <Copy className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">Port</span>
          <span className="text-sm text-slate-900">{access.port ?? "-"}</span>
        </div>

        {hasPrivateKey && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <Key className="w-3.5 h-3.5" />
                SSH Private Key
                {isAdminAccess && (
                  <span className="text-slate-400">· Admin-Zugang</span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSshKeyVisible((v) => !v)}
                  title={sshKeyVisible ? "Key ausblenden" : "Key anzeigen"}
                >
                  {sshKeyVisible ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(access.ssh_private_key, "SSH Private Key")}
                  disabled={!access.ssh_private_key}
                  title="In Zwischenablage kopieren"
                >
                  <Copy className="w-4 h-4" />
                </Button>
                {canDownloadKey && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={triggerDownload}
                    disabled={sshDownloading}
                    title="Als .pem-Datei herunterladen"
                  >
                    {sshDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
            {sshKeyVisible && (
              <pre className="text-xs bg-slate-50 border border-slate-200 rounded-md p-3 font-mono whitespace-pre-wrap break-all overflow-x-auto max-h-64">
{access.ssh_private_key}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
