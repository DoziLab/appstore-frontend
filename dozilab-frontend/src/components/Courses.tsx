import { BookOpen, Users, Server, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

export function Courses() {
  const courses = [
    {
      code: 'CS101',
      name: 'Informatik 101',
      students: 45,
      applications: [
        { name: 'Jupyter Notebook', status: 'running', users: 42 },
        { name: 'Python Entwicklungsumgebung', status: 'running', users: 38 },
      ],
    },
    {
      code: 'CS202',
      name: 'Software Engineering',
      students: 32,
      applications: [
        { name: 'GitLab Server', status: 'running', users: 30 },
        { name: 'Jenkins CI/CD', status: 'running', users: 28 },
        { name: 'Entwicklungs-VMs', status: 'running', users: 32 },
      ],
    },
    {
      code: 'CS305',
      name: 'Cloud Computing',
      students: 28,
      applications: [
        { name: 'Kubernetes Cluster', status: 'deploying', users: 0 },
        { name: 'Docker Registry', status: 'running', users: 24 },
      ],
    },
    {
      code: 'CS410',
      name: 'Cybersicherheit',
      students: 35,
      applications: [
        { name: 'Pentest Laborumgebung', status: 'running', users: 28 },
        { name: 'Verwundbare VMs', status: 'running', users: 31 },
        { name: 'Netzwerkanalyse-Tools', status: 'running', users: 26 },
      ],
    },
    {
      code: 'CS150',
      name: 'Einführung in die Programmierung',
      students: 52,
      applications: [
        { name: 'Entwicklungs-VM', status: 'stopped', users: 0 },
      ],
    },
    {
      code: 'CS310',
      name: 'Datenbanksysteme',
      students: 38,
      applications: [
        { name: 'PostgreSQL Cluster', status: 'running', users: 35 },
        { name: 'MongoDB Instanz', status: 'running', users: 30 },
        { name: 'Redis Cache', status: 'running', users: 22 },
      ],
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Läuft</Badge>;
      case 'deploying':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Wird bereitgestellt</Badge>;
      case 'stopped':
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Gestoppt</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-slate-900 mb-2">Kurse</h1>
          <p className="text-slate-600">Verwalten Sie Anwendungen für Ihre Kurse</p>
        </div>
        <Button className="bg-teal-500 hover:bg-teal-600 text-white">
          <BookOpen className="w-4 h-4 mr-2" />
          Kurs hinzufügen
        </Button>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {courses.map((course) => (
          <Card key={course.code} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-slate-900">{course.code}</span>
                      <p className="text-sm text-slate-600 mt-1">{course.name}</p>
                    </div>
                  </CardTitle>
                </div>
                <Badge variant="outline" className="border-slate-300">
                  <Users className="w-3 h-3 mr-1" />
                  {course.students}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-slate-600">Bereitgestellte Anwendungen</span>
                  <span className="text-slate-900">{course.applications.length}</span>
                </div>
                
                <div className="space-y-2">
                  {course.applications.map((app, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-teal-200 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Server className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-900 truncate">{app.name}</p>
                          <p className="text-xs text-slate-500">{app.users} aktive Nutzer</p>
                        </div>
                      </div>
                      {getStatusBadge(app.status)}
                    </div>
                  ))}
                </div>

                <Button variant="ghost" className="w-full mt-4 text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                  Anwendungen verwalten
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
