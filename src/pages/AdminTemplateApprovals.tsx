import {
  Cpu,
  HardDrive,
  Database,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  X,
  Check,
  MessageSquare,
  Server
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { useEffect, useState } from 'react';
import { getTemplates, TemplateDto } from '../api/templates';
import {
  approveTemplateVersion,
  getTemplateVersionsQueue,
  rejectTemplateVersion,
  type TemplateVersionQueueItem,
} from '../api/github';
import { getFlavors, FlavorDto } from '../api/openstack';

export function AdminTemplateApprovals() {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [pendingVersions, setPendingVersions] = useState<TemplateVersionQueueItem[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [queueLoadError, setQueueLoadError] = useState<string | null>(null);
  const [versionErrors, setVersionErrors] = useState<Record<string, string>>({});
  const [templateById, setTemplateById] = useState<Map<string, TemplateDto>>(new Map());
  const [flavorsByName, setFlavorsByName] = useState<Map<string, FlavorDto>>(new Map());

  const loadQueue = async () => {
    setVersionsLoading(true);
    try {
      const resp = await getTemplateVersionsQueue({
        status: 'pending',
        visibility: 'public',
        page_size: 50,
      });
      setPendingVersions(resp.data);
      setQueueLoadError(null);
    } catch (err) {
      console.error('Approval-Queue konnte nicht geladen werden', err);
      setQueueLoadError('Approval-Queue konnte nicht geladen werden.');
    } finally {
      setVersionsLoading(false);
    }
  };

  const setVersionError = (versionId: string, message: string | null) => {
    setVersionErrors((prev) => {
      const next = { ...prev };
      if (message === null) delete next[versionId];
      else next[versionId] = message;
      return next;
    });
  };

  const handleApprove = async (versionId: string) => {
    try {
      await approveTemplateVersion(versionId);
      setPendingVersions((prev) => prev.filter((v) => v.id !== versionId));
      setRejectionReason('');
      setSelectedVersionId(null);
      setVersionError(versionId, null);
    } catch (err) {
      const message = err instanceof Error && err.message
        ? err.message
        : 'Version konnte nicht genehmigt werden.';
      setVersionError(versionId, message);
    }
  };

  const handleReject = async (versionId: string) => {
    try {
      await rejectTemplateVersion(versionId, rejectionReason.trim() || undefined);
      setPendingVersions((prev) => prev.filter((v) => v.id !== versionId));
      setRejectionReason('');
      setSelectedVersionId(null);
      setVersionError(versionId, null);
    } catch (err) {
      const message = err instanceof Error && err.message
        ? err.message
        : 'Version konnte nicht abgelehnt werden.';
      setVersionError(versionId, message);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  useEffect(() => {
    if (pendingVersions.length === 0) return;
    const ids = [...new Set(pendingVersions.map((v) => v.template.id))].filter(
      (id) => !templateById.has(id),
    );
    if (ids.length === 0) return;
    getTemplates({ page_size: 100, status: 'pending' })
      .then((resp) => {
        setTemplateById((prev) => {
          const next = new Map(prev);
          for (const t of resp.data) next.set(t.id, t);
          return next;
        });
      })
      .catch(() => {
        /* nicht kritisch — fällt auf owner_id zurück */
      });
  }, [pendingVersions, templateById]);

  useEffect(() => {
    getFlavors()
      .then((resp) => {
        setFlavorsByName(new Map(resp.flavors.map((f) => [f.name, f])));
      })
      .catch((err) => {
        console.error('Failed to load flavors', err);
      });
  }, []);

  const approvalQueueEmpty = !versionsLoading && pendingVersions.length === 0;

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-slate-900 mb-2 flex items-center gap-2">
          <FileCheck className="w-6 h-6 text-teal-600" />
          Template-Freigaben
        </h1>
        <p className="text-slate-600">
          Prüfen und genehmigen Sie öffentliche Template-Versionen
        </p>
      </div>

      {/* Template Approvals Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Template-Freigaben</CardTitle>
              <CardDescription className="mt-1">
                {approvalQueueEmpty
                  ? 'Keine offenen Template-Versionen.'
                  : 'Pro Version genehmigen oder ablehnen. Eine Ablehnung kann mit einem Hinweis versehen werden, den der Dozent sieht.'}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={loadQueue} disabled={versionsLoading}>
                Aktualisieren
              </Button>
              {approvalQueueEmpty ? (
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Alles geprüft
                </Badge>
              ) : (
                <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {pendingVersions.length} warten auf Freigabe
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        {approvalQueueEmpty ? (
          <CardContent className="py-8 text-center text-slate-500">
             Nichts zu prüfen.
          </CardContent>
        ) : (
          <CardContent className="space-y-4 pt-2">
            {queueLoadError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {queueLoadError}
              </div>
            )}
            {versionsLoading && (
              <div className="text-sm text-slate-500">Lädt…</div>
            )}
            {pendingVersions.map((version) => {
              const template = templateById.get(version.template.id);
              const ownerLabel =
                template?.owner_name ??
                template?.owner_username ??
                version.template.owner_id;
              const ownerEmail = template?.owner_email ?? undefined;
              const flavorParam = version.parameters?.find((p) => p.name === 'flavor');
              const flavorName = flavorParam?.default as string | undefined;
              const flavor = flavorName ? flavorsByName.get(flavorName) : undefined;
              const cpuLabel = flavor
                ? `${flavor.vcpus} ${flavor.vcpus === 1 ? 'Kern' : 'Kerne'}`
                : '—';
              const ramLabel = flavor ? `${Math.round(flavor.ram_mb / 1024)} GB` : '—';
              const diskLabel = flavor ? `${flavor.disk_gb} GB` : '—';

              return (
                <Card key={version.id} className="border-slate-200">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          <h3 className="text-slate-900 break-words">{version.template.name}</h3>
                          <Badge variant="outline">v{version.version}</Badge>
                          <Badge
                            className={
                              version.template.visibility === 'public'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-700'
                            }
                          >
                            {version.template.visibility === 'public' ? 'Öffentlich' : 'Privat'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-slate-500 flex-wrap">
                          <span>Eingereicht: {new Date(version.created_at).toLocaleString()}</span>
                          <span title={ownerEmail}>von {ownerLabel}</span>
                          <span className="font-mono text-xs">
                            {version.git_commit_sha.slice(0, 8)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ressourcen-Anforderungen */}
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Cpu className="w-4 h-4 text-blue-600" />
                          <span className="text-xs text-blue-600">CPU-Kerne</span>
                        </div>
                        <p className="text-slate-900">{cpuLabel}</p>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Database className="w-4 h-4 text-purple-600" />
                          <span className="text-xs text-purple-600">RAM</span>
                        </div>
                        <p className="text-slate-900">{ramLabel}</p>
                      </div>
                      <div className="p-3 bg-teal-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Server className="w-4 h-4 text-teal-600" />
                          <span className="text-xs text-teal-600">Flavor</span>
                        </div>
                        <p className="text-slate-900 text-sm">{flavorName ?? '—'}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <HardDrive className="w-4 h-4 text-slate-600" />
                          <span className="text-xs text-slate-600">Speicher</span>
                        </div>
                        <p className="text-slate-900">{diskLabel}</p>
                      </div>
                    </div>

                    {/* Repo & Commit */}
                    {template?.repo_url && (
                      <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                        <span className="truncate">
                          <span className="font-medium">Repo:</span> {template.repo_url}
                        </span>
                      </div>
                    )}

                    {/* Rejection-Reason-Bereich */}
                    {selectedVersionId === version.id && (
                      <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-4 h-4 text-slate-600" />
                          <span className="text-sm text-slate-700">
                            Optionaler Hinweis bei Ablehnung
                          </span>
                        </div>
                        <Textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="z. B. Heat-Template referenziert undefinierten Parameter X"
                          className="mt-2"
                          rows={3}
                        />
                        <p className="text-xs text-slate-500 mt-2">
                          Wird dem Dozenten in der Versionsübersicht angezeigt,
                          damit er Korrektur einreichen kann.
                        </p>
                      </div>
                    )}

                    {/* Pro-Version Fehler */}
                    {versionErrors[version.id] && (
                      <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                        {versionErrors[version.id]}
                      </div>
                    )}

                    {/* Aktions-Buttons */}
                    <div className="flex items-center justify-end gap-2">
                      {selectedVersionId === version.id ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedVersionId(null);
                              setRejectionReason('');
                            }}
                          >
                            Abbrechen
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleReject(version.id)}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Ablehnen
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleApprove(version.id)}
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Genehmigen
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setSelectedVersionId(version.id)}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Ablehnen
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleApprove(version.id)}
                          >
                            <FileCheck className="w-4 h-4 mr-2" />
                            Schnell genehmigen
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
