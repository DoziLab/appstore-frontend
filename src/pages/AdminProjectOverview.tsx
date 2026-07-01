import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
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
import { getMyCourses, type CourseDto } from '../api/courses';
import { getKeycloakGroups, type KeycloakGroup } from '../api/keycloak';

export function AdminProjectOverview() {
  const navigate = useNavigate();
  const [deployments, setDeployments] = useState<DeploymentDto[]>([]);
  const [view, setView] = useState<'lecturer' | 'course' | 'date'>('lecturer');
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherInfo | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [coursesData, setCoursesData] = useState<CourseDto[]>([]);
  const [groups, setGroups] = useState<KeycloakGroup[]>([]);

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

  const totalDeployments = deployments.length;

  const activeDeployments = deployments.filter(
    (d) => d.status === 'running'
  ).length;

  const inactiveDeployments = deployments.filter(
    (d) => d.status !== 'running'
  ).length;

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

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-slate-900 mb-2 flex items-center gap-2">
          <Activity className="w-6 h-6 text-red-600" />
          Projektübersicht
        </h1>
        <p className="text-slate-600">
          Übersicht über alle Deployments und deren Status
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">

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

      {/* Deployments Overview */}
      <div>
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
                          <TableCell className="text-slate-900 whitespace-normal break-words">
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
                    <h3 className="text-lg font-semibold text-slate-900 break-words">Deployments von {selectedTeacher.name}</h3>
                    <p className="text-sm text-slate-500 break-all">{selectedTeacher.email}</p>
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
                            <TableCell className="text-slate-900 text-blue-600 hover:underline whitespace-normal break-words">{d.name}</TableCell>
                            <TableCell className="whitespace-normal break-words">{extractCourse(d)}</TableCell>
                            <TableCell className="whitespace-normal break-words">{d.template_version?.template_name || '—'}</TableCell>
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
                    <h3 className="text-lg font-semibold text-slate-900 break-words">Deployments im Kurs {selectedCourse}</h3>
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
                            <TableCell className="text-slate-900 text-blue-600 hover:underline whitespace-normal break-words">{d.name}</TableCell>
                            <TableCell className="whitespace-normal break-words">{extractTeacher(d).name}</TableCell>
                            <TableCell className="whitespace-normal break-words">{d.template_version?.template_name || '—'}</TableCell>
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
                        <TableCell className="text-blue-600 hover:underline whitespace-normal break-words">{d.name}</TableCell>
                        <TableCell className="whitespace-normal break-words">{extractCourse(d)}</TableCell>
                        <TableCell className="whitespace-normal break-words">{extractTeacher(d).name}</TableCell>
                        <TableCell className="text-sm text-slate-600">{new Date(d.created_at).toLocaleString()}</TableCell>
                        <TableCell><Badge variant="outline">{d.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
      </div>
    </div>
  );
}
