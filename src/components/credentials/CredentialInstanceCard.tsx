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
import { Copy, Download, Eye, EyeOff } from "lucide-react";
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
   */
  onDownloadSshKey?: (accessId: string, username: string | null) => void;
}

export function CredentialInstanceCard({
  instance,
  mode,
  passwordVisibility,
  togglePasswordVisibility,
  handleCopy,
  getMaskedPassword,
  onDownloadSshKey,
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
}: {
  groupsByLabel: Map<string, CredentialAccess[]>;
  instanceId: string;
  passwordVisibility: Record<string, boolean>;
  togglePasswordVisibility: (key: string) => void;
  handleCopy: (value: string | null | undefined, label: string) => void;
  getMaskedPassword: (pw: string | null | undefined) => string;
  onDownloadSshKey?: (accessId: string, username: string | null) => void;
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
}: {
  accessKey: string;
  access: CredentialAccess;
  passwordVisibility: Record<string, boolean>;
  togglePasswordVisibility: (key: string) => void;
  handleCopy: (value: string | null | undefined, label: string) => void;
  getMaskedPassword: (pw: string | null | undefined) => string;
  onDownloadSshKey?: (accessId: string, username: string | null) => void;
}) {
  const urlLabel =
    access.access_type === "ssh"
      ? "SSH-Befehl"
      : access.access_type === "web_url"
        ? "URL"
        : "Connection URL";

  const isVisible = passwordVisibility[accessKey] === true;
  // SSH-Key-Download nur zeigen, wenn (a) der Caller einen Handler liefert,
  // (b) es ein SSH-Access ist und (c) der Backend-Eintrag tatsächlich eine
  // access.id liefert. Lecturer-Mode kann optional ohne Handler laufen und
  // den Key im Bundle-Download mitschicken.
  const canDownloadKey =
    !!onDownloadSshKey && access.access_type === "ssh" && !!access.id;

  return (
    <div className="rounded-lg border border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-slate-900">
          {accessTypeLabels[access.access_type] || access.access_type}
        </h4>
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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-500">{urlLabel}</span>
          <div className="flex items-center gap-2">
            {access.connection_url ? (
              access.access_type === "web_url" ? (
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

        {canDownloadKey && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-500">SSH Private Key</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDownloadSshKey?.(access.id, access.username)}
            >
              <Download className="w-4 h-4 mr-2" />
              PEM herunterladen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
