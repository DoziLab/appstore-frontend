import {
  Activity,
  Server,
  Cpu,
  HardDrive,
  Database,
  AlertTriangle,
  CheckCircle2,
  FileCheck,
  X,
  Check,
  MessageSquare,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
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
import { useNavigate } from 'react-router-dom';
import { getAllDeployments, DeploymentDto } from '../api/deployments';
import { getTemplates, TemplateDto } from '../api/templates';
import {
  approveTemplateVersion,
  getTemplateVersionsQueue,
  rejectTemplateVersion,
  type TemplateVersionQueueItem,
} from '../api/github';
import { getFlavors, FlavorDto } from '../api/openstack';
import { getMyCourses, type CourseDto } from '../api/courses';
import { getKeycloakGroups, type KeycloakGroup } from '../api/keycloak';
import React from 'react';




export function AdminMonitoring() {
  const navigate = useNavigate();
  const [deployments, setDeployments] = useState<DeploymentDto[]>([]);
  const [view, setView] = useState<'lecturer' | 'course' | 'date'>('lecturer');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherInfo | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [coursesData, setCoursesData] = useState<CourseDto[]>([]);
  const [groups, setGroups] = useState<KeycloakGroup[]>([]);

  // Approval-Queue: wir tracken die ausgewählte Version (per ID), nicht das
  // Template — Approval läuft jetzt pro TemplateVersion. Die Queue wird
  // initial mit status=pending geladen, kann aber per Filter erweitert werden.
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [pendingVersions, setPendingVersions] = useState<TemplateVersionQueueItem[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  // Fehler beim Laden der Queue ist seitenweit (oben in der Card).
  const [queueLoadError, setQueueLoadError] = useState<string | null>(null);
  // Approve/Reject-Fehler hingegen sind pro Version — wir wollen die Meldung
  // direkt unter dem betroffenen Template anzeigen, nicht oben in der Card.
  const [versionErrors, setVersionErrors] = useState<Record<string, string>>({});
  // Owner-Daten der Versionen werden im Queue-Response nur als ID mitgeliefert.
  // Wir holen die zugehörigen Templates separat, um Owner-Name/-Email zu
  // zeigen — das Templates-Listing-Endpoint hat diese Cache-Felder bereits.
  const [templateById, setTemplateById] = useState<Map<string, TemplateDto>>(new Map());

  // Nova flavor catalog, keyed by flavor name (matches the value of the
  // template's `flavor` parameter default). Used to render real vCPU/RAM/Disk
  // numbers instead of hardcoded multipliers. Empty Map = not loaded yet.
  const [flavorsByName, setFlavorsByName] = useState<Map<string, FlavorDto>>(new Map());

  const loadQueue = async () => {
    setVersionsLoading(true);
    try {
      // Approval gilt laut Backend nur für `visibility=public` — alle anderen
      // Versionen werfen beim approve/reject 400 ("Approval flow applies only
      // to public templates"). Wir filtern serverseitig, damit die Queue nur
      // Versionen zeigt, die wir tatsächlich abnicken können.
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

  // Hilfsfunktion: einen Version-spezifischen Fehler im Map-State setzen oder
  // löschen — wird in handleApprove/handleReject für die per-Version Anzeige
  // unterhalb des jeweiligen Templates verwendet.
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
      // Backend liefert die konkrete Ursache (z. B. „Approval flow applies
      // only to public templates" → 400). apiFetch packt sie in `message`,
      // also leiten wir sie direkt weiter statt sie wegzuwerfen.
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
    // Admin view: pass null → backend doesn't apply the project filter.
    getAllDeployments(null)
      .then(setDeployments)
      .catch(console.error);
  }, []);

  // Load courses for course name resolution
  useEffect(() => {
    getMyCourses()
      .then((resp) => setCoursesData(resp.data))
      .catch((err) => console.error('Failed to load courses', err));
  }, []);

  // Load Keycloak groups for course name resolution
  useEffect(() => {
    getKeycloakGroups()
      .then((resp) => setGroups(resp.data))
      .catch((err) => console.error('Failed to load groups', err));
  }, []);

  useEffect(() => {
    loadQueue();
  }, []);

  // Owner-Daten nachziehen: das Queue-Response trägt nur `owner_id` pro
  // Template-Inline. Wir wandeln die Liste der einmaligen Template-IDs in ein
  // Templates-Listing-Lookup um, damit wir Owner-Name/Email zeigen können.
  useEffect(() => {
    if (pendingVersions.length === 0) return;
    const ids = [...new Set(pendingVersions.map((v) => v.template.id))].filter(
      (id) => !templateById.has(id),
    );
    if (ids.length === 0) return;
    // Wir nutzen das bestehende Templates-Listing — es trägt owner_name etc.
    // Cache nicht ganz präzise (filter by id existiert nicht), daher ein
    // großzügiger page_size; in der Praxis sind das im Approval-Queue-Kontext
    // wenige Einträge.
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

  // percent helper removed (was only used for quotas)

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

  const extractCourse = (deployment: DeploymentDto): string => {
    let resolvedCourseName = 'Unbekannt';

    // Try to resolve course name from course_id first
    if (deployment.course_id) {
      const course = coursesData.find((c) => c.id === deployment.course_id);
      if (course) {
        // If course has keycloak_course_id, try to resolve the Keycloak group name
        if ((course as any).keycloak_course_id) {
          const group = groups.find(
            (g) => g.id === (course as any).keycloak_course_id
          );
          resolvedCourseName = group?.name || course.name || resolvedCourseName;
        } else {
          // Fall back to course name
          resolvedCourseName = course.name || resolvedCourseName;
        }
      }
    }

    // Fall back to course.name from backend if available
    if (resolvedCourseName === 'Unbekannt' && deployment.course?.name) {
      resolvedCourseName = deployment.course.name;
    }

    return resolvedCourseName;
  };


  type ProjectHealth = 'healthy' | 'warning' | 'error';

  const getProjectHealth = (deployments: DeploymentDto[]): ProjectHealth => {
    const statuses = deployments.map(d => d.status);

    if (statuses.includes('failed')) return 'error';
    if (statuses.some(s => s !== 'running')) return 'warning';

    return 'healthy';
  };

  // Group by teacher for "lecturer" view
  type TeacherAggregate = {
    teacher: TeacherInfo;
    deployments: DeploymentDto[];
  };

  const projects: TeacherAggregate[] = Object.values(
    deployments.reduce<Record<string, TeacherAggregate>>((acc, deployment) => {
      const teacher = extractTeacher(deployment);
      const key = teacher.id;

      if (!acc[key]) {
        acc[key] = {
          teacher,
          deployments: [],
        };
      }

      acc[key].deployments.push(deployment);
      return acc;
    }, {})
  );

  // Group by course name for "course" view
  type CourseAggregate = {
    courseName: string;
    deployments: DeploymentDto[];
  };

  const courses: CourseAggregate[] = Object.values(
    deployments.reduce<Record<string, CourseAggregate>>((acc, deployment) => {
      const courseName = extractCourse(deployment);

      if (!acc[courseName]) {
        acc[courseName] = {
          courseName,
          deployments: [],
        };
      }

      acc[courseName].deployments.push(deployment);
      return acc;
    }, {}),
  );

  // Deployments sorted by date for "date" view
  const deploymentsByDate = [...deployments].sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

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

  // True wenn die Approval-Queue nichts Offenes enthält (und nicht gerade lädt).
  // Steuert ob wir die Approval-Karte als kompakten Hinweis oder als volle
  // Liste rendern.
  const approvalQueueEmpty = !versionsLoading && pendingVersions.length === 0;




  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-slate-900 mb-2">Administration</h1>
        <p className="text-slate-600">
          Globale Ressourcenüberwachung und Verwaltung der Deployments
        </p>
      </div>

      {/* Global Resource Overview removed: quotas are no longer shown */}

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
      {/* Dozenten-Projekte */}
      <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Deployments</CardTitle>
                  <CardDescription className='mt-1'>
                    Übersicht über alle Deployments
                  </CardDescription>
                </div>

                {!selectedTeacher && !selectedCourse && (
                  <div>
                    <label className="sr-only">Ansicht</label>
                    <select
                      aria-label="Ansicht wählen"
                      value={view}
                      onChange={(e) => setView(e.target.value as any)}
                      className="border rounded px-2 py-1 text-sm"
                    >
                      <option value="lecturer">Nach Dozent</option>
                      <option value="course">Nach Kurs</option>
                      <option value="date">Nach Datum</option>
                    </select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {view === 'lecturer' && !selectedTeacher && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dozent</TableHead>
                      <TableHead>Deployments</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project) => {
                      const stats = getDeploymentStats(project.deployments);
                      const health = getProjectHealth(project.deployments);

                      return (
                        <TableRow
                          key={project.teacher.id}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => setSelectedTeacher(project.teacher)}
                        >
                          <TableCell className="text-slate-900">
                            {project.teacher.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {project.deployments.length}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {renderHealthBadge(health)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {view === 'lecturer' && selectedTeacher && (
                <div className="space-y-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTeacher(null)}
                  >
                    ← Zurück
                  </Button>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Deployments von {selectedTeacher.name}</h3>
                    <p className="text-sm text-slate-500">{selectedTeacher.email}</p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Deployment-Name</TableHead>
                        <TableHead>Kurs</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Erstellt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deployments
                        .filter((d) => extractTeacher(d).id === selectedTeacher.id)
                        .map((d) => (
                          <TableRow
                            key={d.id}
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => navigate(`/deployment/${d.id}`)}
                          >
                            <TableCell className="text-slate-900 text-blue-600 hover:underline">{d.name}</TableCell>
                            <TableCell>{extractCourse(d)}</TableCell>
                            <TableCell>{d.template_version?.template_name || '—'}</TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {new Date(d.created_at).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {view === 'course' && !selectedCourse && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kurs</TableHead>
                      <TableHead>Deployments</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map((c) => {
                      const stats = getDeploymentStats(c.deployments);
                      const health = getProjectHealth(c.deployments);

                      return (
                        <TableRow
                          key={c.courseName}
                          className="cursor-pointer hover:bg-slate-50"
                          onClick={() => setSelectedCourse(c.courseName)}
                        >
                          <TableCell className="text-slate-900">
                            {c.courseName}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {c.deployments.length}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {renderHealthBadge(health)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {view === 'course' && selectedCourse && (
                <div className="space-y-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedCourse(null)}
                  >
                    ← Zurück
                  </Button>
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">Deployments im Kurs {selectedCourse}</h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Deployment-Name</TableHead>
                        <TableHead>Dozent</TableHead>
                        <TableHead>Template</TableHead>
                        <TableHead>Erstellt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deployments
                        .filter((d) => extractCourse(d) === selectedCourse)
                        .map((d) => (
                          <TableRow
                            key={d.id}
                            className="cursor-pointer hover:bg-slate-50"
                            onClick={() => navigate(`/deployment/${d.id}`)}
                          >
                            <TableCell className="text-slate-900 text-blue-600 hover:underline">{d.name}</TableCell>
                            <TableCell>{extractTeacher(d).name}</TableCell>
                            <TableCell>{d.template_version?.template_name || '—'}</TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {new Date(d.created_at).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {view === 'date' && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Kurs</TableHead>
                      <TableHead>Dozent</TableHead>
                      <TableHead>Erstellt</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deploymentsByDate.map((d) => (
                      <TableRow
                        key={d.id}
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => navigate(`/deployment/${d.id}`)}
                      >
                        <TableCell className="text-blue-600 hover:underline">{d.name}</TableCell>
                        <TableCell>{extractCourse(d)}</TableCell>
                        <TableCell>{extractTeacher(d).name}</TableCell>
                        <TableCell className="text-sm text-slate-600">{new Date(d.created_at).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Template-Freigaben — aus dem alten Tabs-Layout in eine eigene
              Karte unterhalb der Deployments umgezogen. Logik (per-Version
              Approval-Queue, Owner-Lookup, Reject-Reason) kommt unverändert
              aus dem staging-Branch. Wenn nichts offen ist, zeigen wir eine
              kompakte Ein-Zeilen-Karte; sobald Versionen warten, klappt die
              Liste in voller Höhe auf — analog zur Deployments-Karte. */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Template-Freigaben</CardTitle>
                  <CardDescription className="mt-1">
                    {approvalQueueEmpty
                      ? 'Keine offenen Template-Versionen — nichts zu prüfen.'
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
            {/* Bei leerer Queue lassen wir den Body weg — der Hinweis steht
                schon in der CardDescription, doppelte „keine offenen
                Versionen"-Zeile wäre redundant. */}
            {!approvalQueueEmpty && (
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

                        {/* Ressourcen-Anforderungen — leitet sich aus dem
                            flavor-Parameter ab, sofern das Template einen
                            definiert. Falls nicht: alles „—". */}
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

                        {/* Pro-Version Fehler — direkt am betroffenen
                            Template, statt oben in der Card-übergreifenden
                            Fehlerleiste. */}
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
    </div>
  );
}
