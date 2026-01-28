import {
  Activity,
  Server,
  Users,
  TrendingUp,
  Cpu,
  HardDrive,
  Database,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  Eye,
  FileCheck,
  X,
  Check,
  MessageSquare
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { useEffect, useState } from 'react';
import {
  getAllDeployments,
  getDeploymentLogs,
  DeploymentDto,
  DeploymentLogDto,
} from '../api/deployments';
import { getQuotas, QuotasResponse } from '../api/quotas';



// Mock data für Dozenten-Projekte
const dozentenProjekte = [
  {
    id: 1,
    dozent: 'Prof. Dr. Schmidt',
    email: 'schmidt@uni.edu',
    aktiveDeployments: 3,
    vCPUs: 12,
    ram: 24,
    storage: 180,
    vms: 3,
    letzteAktivitaet: '2 Stunden',
    status: 'aktiv'
  },
  {
    id: 2,
    dozent: 'Dr. Müller',
    email: 'mueller@uni.edu',
    aktiveDeployments: 5,
    vCPUs: 20,
    ram: 40,
    storage: 300,
    vms: 5,
    letzteAktivitaet: '30 Minuten',
    status: 'aktiv'
  },
  {
    id: 3,
    dozent: 'Prof. Weber',
    email: 'weber@uni.edu',
    aktiveDeployments: 2,
    vCPUs: 8,
    ram: 16,
    storage: 120,
    vms: 2,
    letzteAktivitaet: '5 Tage',
    status: 'inaktiv'
  },
  {
    id: 4,
    dozent: 'Dr. Fischer',
    email: 'fischer@uni.edu',
    aktiveDeployments: 4,
    vCPUs: 16,
    ram: 32,
    storage: 240,
    vms: 4,
    letzteAktivitaet: '1 Stunde',
    status: 'aktiv'
  },
  {
    id: 5,
    dozent: 'Prof. Becker',
    email: 'becker@uni.edu',
    aktiveDeployments: 1,
    vCPUs: 4,
    ram: 8,
    storage: 60,
    vms: 1,
    letzteAktivitaet: '12 Tage',
    status: 'warnung'
  },
];



// Globale Ressourcenstatistiken
const gesamtQuotas = {
  vCPUs: { verwendet: 60, verfuegbar: 256, prozent: (60 / 256) * 100 },
  ram: { verwendet: 120, verfuegbar: 512, prozent: (120 / 512) * 100 },
  storage: { verwendet: 900, verfuegbar: 5120, prozent: (900 / 5120) * 100 },
  vms: { verwendet: 15, verfuegbar: 100, prozent: (15 / 100) * 100 },
};

// Mock data für ausstehende Template-Freigaben
const pendingTemplates = [
  {
    id: 1,
    name: 'Python Data Science Environment',
    version: 'v2.1.0',
    eingereichtVon: 'Prof. Dr. Schmidt',
    eingereichtAm: '2025-12-28 10:30',
    cpu: 8,
    ram: 16,
    gpu: 1,
    storage: 80,
    beschreibung: 'Vollständige Python-Umgebung mit Jupyter, pandas, numpy, scikit-learn und TensorFlow',
    status: 'pending',
    exceedsThreshold: true
  },
  {
    id: 2,
    name: 'Web Development Stack',
    version: 'v1.5.2',
    eingereichtVon: 'Dr. Müller',
    eingereichtAm: '2025-12-29 14:15',
    cpu: 4,
    ram: 8,
    gpu: 0,
    storage: 50,
    beschreibung: 'Node.js, React, PostgreSQL, Redis für moderne Webentwicklung',
    status: 'pending',
    exceedsThreshold: false
  },
  {
    id: 3,
    name: 'Machine Learning Laboratory',
    version: 'v3.0.0',
    eingereichtVon: 'Prof. Weber',
    eingereichtAm: '2025-12-27 09:45',
    cpu: 16,
    ram: 32,
    gpu: 2,
    storage: 150,
    beschreibung: 'High-Performance ML-Umgebung mit CUDA, PyTorch, TensorFlow und Keras',
    status: 'pending',
    exceedsThreshold: true
  },
];

export function AdminMonitoring() {
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [approvalComment, setApprovalComment] = useState('');

  const [deployments, setDeployments] = useState<DeploymentDto[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentDto | null>(null);
  const [deploymentLogs, setDeploymentLogs] = useState<DeploymentLogDto[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [quotas, setQuotas] = useState<QuotasResponse | null>(null);


  const handleApprove = (templateId: number) => {
    console.log(`Template ${templateId} genehmigt mit Kommentar:`, approvalComment);
    setApprovalComment('');
    setSelectedTemplate(null);
    // Hier würde die tatsächliche Genehmigungslogik erfolgen
  };

  const handleReject = (templateId: number) => {
    console.log(`Template ${templateId} abgelehnt mit Kommentar:`, approvalComment);
    setApprovalComment('');
    setSelectedTemplate(null);
    // Hier würde die tatsächliche Ablehnungslogik erfolgen
  };

  useEffect(() => {
    getAllDeployments()
      .then(setDeployments)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedDeployment) return;

    setLogsLoading(true);
    getDeploymentLogs(selectedDeployment.id)
      .then((resp) => setDeploymentLogs(resp.data ?? []))
      .catch(console.error)
      .finally(() => setLogsLoading(false));
  }, [selectedDeployment]);

  useEffect(() => {
    getQuotas()
      .then(setQuotas)
      .catch(console.error);
  }, []);


  const totalDeployments = deployments.length;

  const activeDeployments = deployments.filter(
    (d) => d.status === 'running'
  ).length;

  const inactiveDeployments = deployments.filter(
    (d) => d.status !== 'running'
  ).length;

  const percent = (used: number, limit: number) =>
    limit > 0 ? (used / limit) * 100 : 0;







  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-slate-900 mb-2">Admin Monitoring</h1>
        <p className="text-slate-600">
          Globale Ressourcenüberwachung und Verwaltung der Dozenten-Projekte
        </p>
      </div>

      {/* Global Resource Overview */}
      {quotas && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {/* CPU */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Cpu className="w-6 h-6 text-blue-600" />
                </div>
                <Badge variant="outline" className="text-blue-600 border-blue-200">
                  {percent(quotas.compute.cores.used, quotas.compute.cores.limit).toFixed(1)}%
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-slate-500">vCPUs Global</p>
                <p className="text-2xl text-slate-900">
                  {quotas.compute.cores.used} / {quotas.compute.cores.limit}
                </p>
                <Progress
                  value={percent(quotas.compute.cores.used, quotas.compute.cores.limit)}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* RAM (MB → GB) */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <Database className="w-6 h-6 text-purple-600" />
                </div>
                <Badge variant="outline" className="text-purple-600 border-purple-200">
                  {percent(quotas.compute.ram.used, quotas.compute.ram.limit).toFixed(1)}%
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-slate-500">RAM Global</p>
                <p className="text-2xl text-slate-900">
                  {(quotas.compute.ram.used / 1024).toFixed(1)} / {(quotas.compute.ram.limit / 1024).toFixed(1)} GB
                </p>
                <Progress
                  value={percent(quotas.compute.ram.used, quotas.compute.ram.limit)}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Storage */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                  <HardDrive className="w-6 h-6 text-teal-600" />
                </div>
                <Badge variant="outline" className="text-teal-600 border-teal-200">
                  {percent(quotas.volume.gigabytes.used, quotas.volume.gigabytes.limit).toFixed(1)}%
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-slate-500">Speicher Global</p>
                <p className="text-2xl text-slate-900">
                  {quotas.volume.gigabytes.used} / {quotas.volume.gigabytes.limit} GB
                </p>
                <Progress
                  value={percent(quotas.volume.gigabytes.used, quotas.volume.gigabytes.limit)}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* VMs */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <Server className="w-6 h-6 text-orange-600" />
                </div>
                <Badge variant="outline" className="text-orange-600 border-orange-200">
                  {percent(quotas.compute.instances.used, quotas.compute.instances.limit).toFixed(1)}%
                </Badge>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-slate-500">VM-Instanzen</p>
                <p className="text-2xl text-slate-900">
                  {quotas.compute.instances.used} / {quotas.compute.instances.limit}
                </p>
                <Progress
                  value={percent(quotas.compute.instances.used, quotas.compute.instances.limit)}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Gesamte Deployments */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Gesamte Deployments</p>
                <p className="text-2xl text-slate-900">
                  {totalDeployments}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aktive Deployments */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Aktive Deployments</p>
                <p className="text-2xl text-slate-900">
                  {activeDeployments}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inaktive Deployments */}
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Inaktive Deployments</p>
                <p className="text-2xl text-slate-900">
                  {inactiveDeployments}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>


      {/* Tabs für verschiedene Ansichten */}
      <Tabs defaultValue="projekte" className="space-y-6">
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="projekte">Dozenten-Projekte</TabsTrigger>
          <TabsTrigger value="logs">API-Logs & Monitoring</TabsTrigger>
          <TabsTrigger value="templates">Template-Freigaben</TabsTrigger>
        </TabsList>

        {/* Dozenten-Projekte Tab */}
        <TabsContent value="projekte" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ressourcennutzung pro Dozenten-Projekt</CardTitle>
                  <CardDescription>
                    Übersicht über alle aktiven und inaktiven Projekte mit Ressourcenverbrauch
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dozent</TableHead>
                    <TableHead>Deployments</TableHead>
                    <TableHead>vCPUs</TableHead>
                    <TableHead>RAM (GB)</TableHead>
                    <TableHead>Storage (GB)</TableHead>
                    <TableHead>VMs</TableHead>
                    <TableHead>Letzte Aktivität</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dozentenProjekte.map((projekt) => (
                    <TableRow key={projekt.id}>
                      <TableCell>
                        <div>
                          <p className="text-slate-900">{projekt.dozent}</p>
                          <p className="text-xs text-slate-500">{projekt.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{projekt.aktiveDeployments}</Badge>
                      </TableCell>
                      <TableCell>{projekt.vCPUs}</TableCell>
                      <TableCell>{projekt.ram}</TableCell>
                      <TableCell>{projekt.storage}</TableCell>
                      <TableCell>{projekt.vms}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Clock className="w-3 h-3" />
                          {projekt.letzteAktivitaet}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            projekt.status === 'aktiv'
                              ? 'bg-green-100 text-green-700 hover:bg-green-100'
                              : projekt.status === 'inaktiv'
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-100'
                                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                          }
                        >
                          {projekt.status === 'aktiv' ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Aktiv
                            </>
                          ) : projekt.status === 'inaktiv' ? (
                            'Inaktiv'
                          ) : (
                            <>
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Warnung
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API-Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Deployments & Logs</CardTitle>
                  <CardDescription>
                    Übersicht aller Deployments und zugehöriger Logs
                  </CardDescription>
                </div>

                {selectedDeployment && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedDeployment(null);
                      setDeploymentLogs([]);
                    }}
                  >
                    Zurück zu Deployments
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* ===== Deployment Liste ===== */}
              {!selectedDeployment && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Erstellt</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {deployments.map((deployment) => (
                      <TableRow
                        key={deployment.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => setSelectedDeployment(deployment)}
                      >
                        <TableCell>{deployment.name}</TableCell>

                        <TableCell>
                          <Badge variant="outline">{deployment.status}</Badge>
                        </TableCell>

                        <TableCell className="text-sm text-slate-600">
                          {new Date(deployment.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}

                    {deployments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-slate-500">
                          Keine Deployments vorhanden
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}

              {/* ===== Logs Ansicht ===== */}
              {selectedDeployment && (
                <>
                  <div>
                    <h3 className="text-slate-900">
                      Logs für Deployment: {selectedDeployment.name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      Status: {selectedDeployment.status}
                    </p>
                  </div>

                  {logsLoading && (
                    <div className="text-sm text-slate-500">Logs werden geladen…</div>
                  )}

                  {!logsLoading && deploymentLogs.length === 0 && (
                    <div className="text-sm text-slate-500">
                      Keine Logs für dieses Deployment vorhanden
                    </div>
                  )}

                  {!logsLoading && deploymentLogs.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Zeitstempel</TableHead>
                          <TableHead>Event</TableHead>
                          <TableHead>Nachricht</TableHead>
                          <TableHead>Level</TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {deploymentLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm text-slate-600">
                              {new Date(log.created_at).toLocaleString()}
                            </TableCell>

                            <TableCell>
                              <Badge variant="outline">{log.event_type}</Badge>
                            </TableCell>

                            <TableCell className="text-sm">
                              {log.message}
                            </TableCell>

                            <TableCell>
                              <Badge
                                className={
                                  log.level === 'error'
                                    ? 'bg-red-100 text-red-700'
                                    : log.level === 'warning'
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-blue-100 text-blue-700'
                                }
                              >
                                {log.level}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* Template-Freigaben Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ausstehende Template-Freigaben</CardTitle>
                  <CardDescription>
                    Überprüfen und Genehmigen von neuen Template-Anfragen (AC 2.3, AC 2.4)
                  </CardDescription>
                </div>
                <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {pendingTemplates.length} warten auf Freigabe
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingTemplates.map((template) => (
                <Card key={template.id} className="border-slate-200">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-slate-900">{template.name}</h3>
                          <Badge variant="outline">{template.version}</Badge>
                          {template.exceedsThreshold && (
                            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Überschreitet Schwellenwerte
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-3">{template.beschreibung}</p>
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span>Eingereicht von: <strong>{template.eingereichtVon}</strong></span>
                          <span>·</span>
                          <span>{template.eingereichtAm}</span>
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
                        <p className="text-slate-900">{template.cpu} Kerne</p>
                        {template.cpu > 8 && (
                          <p className="text-xs text-orange-600 mt-1">Max: 8 Kerne</p>
                        )}
                      </div>

                      <div className="p-3 bg-purple-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Database className="w-4 h-4 text-purple-600" />
                          <span className="text-xs text-purple-600">RAM</span>
                        </div>
                        <p className="text-slate-900">{template.ram} GB</p>
                        {template.ram > 16 && (
                          <p className="text-xs text-orange-600 mt-1">Max: 16 GB</p>
                        )}
                      </div>

                      <div className="p-3 bg-teal-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Server className="w-4 h-4 text-teal-600" />
                          <span className="text-xs text-teal-600">GPU</span>
                        </div>
                        <p className="text-slate-900">{template.gpu} {template.gpu === 1 ? 'Einheit' : 'Einheiten'}</p>
                        {template.gpu > 1 && (
                          <p className="text-xs text-orange-600 mt-1">Max: 1 Einheit</p>
                        )}
                      </div>

                      <div className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <HardDrive className="w-4 h-4 text-slate-600" />
                          <span className="text-xs text-slate-600">Speicher</span>
                        </div>
                        <p className="text-slate-900">{template.storage} GB</p>
                      </div>
                    </div>

                    {/* Kommentar-Bereich */}
                    {selectedTemplate === template.id && (
                      <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="w-4 h-4 text-slate-600" />
                          <span className="text-sm text-slate-700">Kommentar zur Genehmigung/Ablehnung</span>
                        </div>
                        <Textarea
                          value={approvalComment}
                          onChange={(e) => setApprovalComment(e.target.value)}
                          placeholder="Fügen Sie einen Kommentar hinzu (optional)..."
                          className="mt-2"
                          rows={3}
                        />
                      </div>
                    )}

                    {/* Aktions-Buttons */}
                    <div className="flex items-center justify-end gap-2">
                      {selectedTemplate === template.id ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTemplate(null);
                              setApprovalComment('');
                            }}
                          >
                            Abbrechen
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleReject(template.id)}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Ablehnen
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => handleApprove(template.id)}
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
                            onClick={() => setSelectedTemplate(template.id)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            Details prüfen
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => {
                              setSelectedTemplate(template.id);
                            }}
                          >
                            <FileCheck className="w-4 h-4 mr-2" />
                            Schnell genehmigen
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}