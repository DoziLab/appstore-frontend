import { Server, Cpu, HardDrive, Activity, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';

interface DashboardProps {
  onSelectDeployment?: (deploymentName: string) => void;
}

export function Dashboard({ onSelectDeployment }: DashboardProps) {
  const stats = [
    { label: 'Aktive Deployments', value: '12', icon: Server, color: 'text-teal-600', bgColor: 'bg-teal-50' },
    { label: 'Verwendete CPU-Kerne', value: '48/64', icon: Cpu, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { label: 'Genutzter Speicher', value: '2.4TB', icon: HardDrive, color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { label: 'Aktive VMs', value: '18', icon: Activity, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  ];

  const deployments = [
    { name: 'CS101 - Jupyter Notebook', status: 'running', course: 'Informatik 101', users: 45, updated: 'Vor 2 Stunden' },
    { name: 'CS202 - GitLab Server', status: 'running', course: 'Software Engineering', users: 32, updated: 'Vor 5 Stunden' },
    { name: 'CS305 - Kubernetes Cluster', status: 'deploying', course: 'Cloud Computing', users: 0, updated: 'Vor 10 Minuten' },
    { name: 'CS410 - Pentest Lab', status: 'running', course: 'Cybersicherheit', users: 28, updated: 'Vor 1 Tag' },
    { name: 'CS150 - Entwicklungs-VM', status: 'stopped', course: 'Einführung in die Programmierung', users: 0, updated: 'Vor 3 Tagen' },
  ];

  const messages = [
    { type: 'info', title: 'Geplante Wartung', message: 'OpenStack-Wartungsfenster: 25. Nov, 02:00 – 04:00 Uhr', time: 'Vor 1 Tag' },
    { type: 'success', title: 'Kontingenterhöhung genehmigt', message: 'Ihre Anfrage für zusätzliche 16 CPU-Kerne wurde genehmigt', time: 'Vor 2 Tagen' },
    { type: 'warning', title: 'Speicherlimit-Warnung', message: 'Sie nutzen 80% Ihres zugewiesenen Speicherkontingents', time: 'Vor 5 Tagen' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="w-3 h-3 mr-1" />Läuft</Badge>;
      case 'deploying':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100"><Clock className="w-3 h-3 mr-1" />Wird bereitgestellt</Badge>;
      case 'stopped':
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Gestoppt</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-slate-900 mb-2">Dashboard</h1>
        <p className="text-slate-600">Übersicht über Ihre bereitgestellten Anwendungen und Ressourcennutzung</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-slate-200 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">{stat.label}</p>
                    <p className="text-slate-900">{stat.value}</p>
                  </div>
                  <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deployments */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Kürzliche Deployments</CardTitle>
            <CardDescription>Ihre aktiven und kürzlich bereitgestellten Anwendungen</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {deployments.map((deployment, idx) => (
                <div 
                  key={idx} 
                  onClick={() => onSelectDeployment?.(deployment.name)}
                  className="flex items-center gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 hover:border-slate-200 cursor-pointer transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="text-slate-900 truncate">{deployment.name}</p>
                      {getStatusBadge(deployment.status)}
                    </div>
                    <p className="text-sm text-slate-500">{deployment.course}</p>
                    <p className="text-xs text-slate-400 mt-1">{deployment.users} aktive Nutzer · Aktualisiert {deployment.updated}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Messages & Resource Quotas */}
        <div className="space-y-6">
          {/* Resource Quotas */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Ressourcenkontingente</CardTitle>
              <CardDescription>Ihre aktuellen Ressourcengrenzen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">CPU-Kerne</span>
                  <span className="text-slate-900">48 / 64</span>
                </div>
                <Progress value={75} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Arbeitsspeicher</span>
                  <span className="text-slate-900">128 / 192 GB</span>
                </div>
                <Progress value={66} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">Speicher</span>
                  <span className="text-slate-900">2.4 / 3.0 TB</span>
                </div>
                <Progress value={80} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-600">VM-Instanzen</span>
                  <span className="text-slate-900">18 / 25</span>
                </div>
                <Progress value={72} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* System Messages */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Systemnachrichten</CardTitle>
              <CardDescription>Wichtige Updates und Mitteilungen</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {messages.map((message, idx) => (
                  <div key={idx} className="flex gap-3">
                    {getMessageIcon(message.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 mb-1">{message.title}</p>
                      <p className="text-xs text-slate-600 mb-1">{message.message}</p>
                      <p className="text-xs text-slate-400">{message.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}