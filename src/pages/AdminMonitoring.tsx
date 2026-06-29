import {
  Activity,
  Server,
  Users,
  Cpu,
  HardDrive,
  Database,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck,
  X,
  Check,
  MessageSquare,
  XCircle
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
import { getTemplates, approveTemplate, rejectTemplate, TemplateDto } from '../api/templates';
import { getFlavors, FlavorDto } from '../api/openstack';
import React from 'react';




export function AdminMonitoring() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [approvalComment, setApprovalComment] = useState('');

  const [deployments, setDeployments] = useState<DeploymentDto[]>([]);
  const [selectedDeployment, setSelectedDeployment] = useState<DeploymentDto | null>(null);
  const [deploymentLogs, setDeploymentLogs] = useState<DeploymentLogDto[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [quotas, setQuotas] = useState<QuotasResponse | null>(null);

  const [pendingTemplates, setPendingTemplates] = useState<TemplateDto[]>([]);
  const [templateActionError, setTemplateActionError] = useState<string | null>(null);

  // Nova flavor catalog, keyed by flavor name (matches the value of the
  // template's `flavor` parameter default). Used to render real vCPU/RAM/Disk
  // numbers instead of hardcoded multipliers. Empty Map = not loaded yet.
  const [flavorsByName, setFlavorsByName] = useState<Map<string, FlavorDto>>(new Map());

  const handleApprove = async (templateId: string) => {
    try {
      await approveTemplate(templateId, approvalComment);
      setPendingTemplates((prev) => prev.filter((t) => t.id !== templateId));
      setApprovalComment('');
      setSelectedTemplate(null);
      setTemplateActionError(null);
    } catch {
      setTemplateActionError('Template konnte nicht genehmigt werden.');
    }
  };

  const handleReject = async (templateId: string) => {
    try {
      await rejectTemplate(templateId, approvalComment);
      setPendingTemplates((prev) => prev.filter((t) => t.id !== templateId));
      setApprovalComment('');
      setSelectedTemplate(null);
      setTemplateActionError(null);
    } catch {
      setTemplateActionError('Template konnte nicht abgelehnt werden.');
    }
  };

  useEffect(() => {
    // Admin view: pass null → backend doesn't apply the project filter.
    getAllDeployments(null)
      .then(setDeployments)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedDeployment) return;

    setLogsLoading(true);
    // Same rationale: admin reads any deployment's logs regardless of project.
    getDeploymentLogs(selectedDeployment.id, null)
      .then((resp) => setDeploymentLogs(resp.data ?? []))
      .catch(console.error)
      .finally(() => setLogsLoading(false));
  }, [selectedDeployment]);

  useEffect(() => {
    getQuotas()
      .then(setQuotas)
      .catch(console.error);
  }, []);

  useEffect(() => {
    getTemplates({ status: 'pending' })
      .then((res) => setPendingTemplates(res.data))
      .catch(console.error);
  }, []);

  // Load flavor catalog once. Pending templates have no per-lecturer context
  // here, so we fetch from the admin's own project — flavors are typically
  // OpenStack-cluster-wide, so this works for the cards' display purpose.
  useEffect(() => {
    getFlavors()
      .then((resp) => {
        setFlavorsByName(new Map(resp.flavors.map((f) => [f.name, f])));
      })
      .catch((err) => {
        console.error('Failed to load flavors', err);
      });
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

  type TeacherInfo = {
    id: string;
    name: string;
    email: string;
  };

  const extractTeacher = (deployment: DeploymentDto): TeacherInfo => {
    try {
      if (!deployment.deployment_parameters) {
        return {
          id: 'unknown',
          name: 'Unbekannt',
          email: '',
        };
      }

      const parsed = JSON.parse(deployment.deployment_parameters);
      const teacher = parsed?.teacher;

      if (!teacher) {
        return {
          id: 'unknown',
          name: 'Unbekannt',
          email: '',
        };
      }

      return {
        id: teacher.id,
        name: `${teacher.first_name} ${teacher.last_name}`,
        email: teacher.email,
      };
    } catch {
      return {
        id: 'unknown',
        name: 'Unbekannt',
        email: '',
      };
    }
  };


  type ProjectHealth = 'healthy' | 'warning' | 'error';

  const getProjectHealth = (deployments: DeploymentDto[]): ProjectHealth => {
    const statuses = deployments.map(d => d.status);

    if (statuses.includes('failed')) return 'error';
    if (statuses.some(s => s !== 'running')) return 'warning';

    return 'healthy';
  };

  type ProjectAggregate = {
    courseId: string;
    projectName: string;
    teacher: TeacherInfo;
    deployments: DeploymentDto[];
  };

  const projects: ProjectAggregate[] = Object.values(
    deployments.reduce<Record<string, ProjectAggregate>>((acc, deployment) => {
      const courseId = deployment.course_id;
      const teacher = extractTeacher(deployment);

      if (!acc[courseId]) {
        acc[courseId] = {
          courseId,
          projectName: deployment.name,
          teacher,
          deployments: [],
        };
      }

      acc[courseId].deployments.push(deployment);
      return acc;
    }, {})
  );

  const getDeploymentStats = (deployments: DeploymentDto[]) => ({
    total: deployments.length,
    running: deployments.filter(d => d.status === 'running').length,
  });

  const renderHealthBadge = (health: ProjectHealth) => {
    switch (health) {
      case 'healthy':
        return (
          <Badge className="bg-green-100 text-green-700">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Gesund
          </Badge>
        );
      case 'warning':
        return (
          <Badge className="bg-yellow-100 text-yellow-700">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Warnung
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-red-100 text-red-700">
            <XCircle className="w-3 h-3 mr-1" />
            Fehler
          </Badge>
        );
    }
  };






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
        {/* TODO (#75): table still uses mock data — needs GET /admin/lecturers/usage from backend.
            Available: GET /openstack-projects (owner_id) + GET /quotas?lecturer_id (per-project).
            Problem: N+1 calls + no user name resolution. Waiting on backend team. */}
        <TabsContent value="projekte" className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Dozenten-Projekte</CardTitle>
                  <CardDescription>
                    Übersicht über alle Dozenten-Projekte und deren Deployments
                  </CardDescription>

                </div>

              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dozent</TableHead>
                    <TableHead>Deployments</TableHead>
                    <TableHead>VMs</TableHead>
                    <TableHead>Letzte Aktivität</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {projects.map((project) => {
                    const stats = getDeploymentStats(project.deployments);
                    const health = getProjectHealth(project.deployments);

                    const lastActivity = new Date(
                      Math.max(
                        ...project.deployments.map((d) =>
                          new Date(d.updated_at).getTime()
                        )
                      )
                    ).toLocaleString();

                    return (
                      <TableRow key={project.courseId}>
                        {/* Dozent */}
                        <TableCell>
                          <div>
                            <p className="text-slate-900">{project.teacher.name}</p>
                            {project.teacher.email && (
                              <p className="text-xs text-slate-500">
                                {project.teacher.email}
                              </p>
                            )}
                          </div>
                        </TableCell>

                        {/* Deployments */}
                        <TableCell>
                          <Badge variant="outline">
                            {stats.running} / {stats.total}
                          </Badge>
                        </TableCell>

                        {/* VMs */}
                        <TableCell>
                          {stats.total}
                        </TableCell>

                        {/* Letzte Aktivität */}
                        <TableCell className="text-sm text-slate-600">
                          {lastActivity}
                        </TableCell>

                        {/* Status / Gesundheit */}
                        <TableCell>
                          {renderHealthBadge(health)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
              {templateActionError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {templateActionError}
                </div>
              )}
              {pendingTemplates.map((template) => (
                <Card key={template.id} className="border-slate-200">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-slate-900 break-words">{template.name}</h3>
                          {template.versions?.[0]?.version && (
                            <Badge variant="outline">{template.versions[0].version}</Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-slate-600 mb-3 break-words">{template.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-slate-500">
                          <span>Eingereicht: {new Date(template.created_at).toLocaleString()}</span>
                          <span title={template.owner_email ?? undefined}>
                            von {template.owner_name ?? template.owner_username ?? template.owner_id}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Ressourcen-Anforderungen */}
                    {(() => {
                      const version = template.versions?.[0];
                      const flavorParam = version?.parameters?.find(p => p.name === 'flavor');
                      const flavorName = flavorParam?.default as string | undefined;
                      // Resolve flavor name → real vCPU/RAM/Disk from the Nova
                      // catalog loaded once at mount. If the template's flavor
                      // default isn't in the catalog (private flavor, typo, or
                      // catalog not loaded yet) we render '—' rather than
                      // falling back to a hardcoded number.
                      const flavor = flavorName ? flavorsByName.get(flavorName) : undefined;
                      const cpuLabel = flavor ? `${flavor.vcpus} ${flavor.vcpus === 1 ? 'Kern' : 'Kerne'}` : '—';
                      const ramLabel = flavor ? `${Math.round(flavor.ram_mb / 1024)} GB` : '—';
                      const diskLabel = flavor ? `${flavor.disk_gb} GB` : '—';
                      return (
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
                            <p className="text-slate-900 text-sm">
                              {flavorName ?? '—'}
                            </p>
                          </div>
                          <div className="p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-2 mb-1">
                              <HardDrive className="w-4 h-4 text-slate-600" />
                              <span className="text-xs text-slate-600">Speicher</span>
                            </div>
                            <p className="text-slate-900">{diskLabel}</p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Repo & Commit */}
                    <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                      <span className="truncate">
                        <span className="font-medium">Repo:</span> {template.repo_url}
                      </span>
                      {template.versions?.[0]?.git_commit_sha && (
                        <span className="font-mono shrink-0">
                          {template.versions[0].git_commit_sha.slice(0, 8)}
                        </span>
                      )}
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
                            onClick={() => setSelectedTemplate(template.id)}
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