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
import { Tabs } from '../components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { useEffect, useState } from 'react';
import { getAllDeployments, DeploymentDto } from '../api/deployments';
import { getFlavors, FlavorDto } from '../api/openstack';
import React from 'react';




export function AdminMonitoring() {
  const [deployments, setDeployments] = useState<DeploymentDto[]>([]);
  const [pendingTemplates, setPendingTemplates] = useState<any[]>([]);

  // Nova flavor catalog, keyed by flavor name (matches the value of the
  // template's `flavor` parameter default). Used to render real vCPU/RAM/Disk
  // numbers instead of hardcoded multipliers. Empty Map = not loaded yet.
  const [flavorsByName, setFlavorsByName] = useState<Map<string, FlavorDto>>(new Map());


  useEffect(() => {
    // Admin view: pass null → backend doesn't apply the project filter.
    getAllDeployments(null)
      .then(setDeployments)
      .catch(console.error);
  }, []);


  // quotas removed: no longer fetching quotas

  // pending templates removed — we only show lecturer projects now

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
      </div>
    </div>
  );
}