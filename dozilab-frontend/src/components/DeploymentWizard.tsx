import { useState } from 'react';
import { Check, ChevronRight, ChevronLeft, Server, Settings, Users, Network, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';

interface DeploymentWizardProps {
  onCancel: () => void;
  onComplete: () => void;
}

export function DeploymentWizard({ onCancel, onComplete }: DeploymentWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isDeploying, setIsDeploying] = useState(false);

  const steps = [
    { id: 0, name: 'Template', icon: Server, description: 'Application-Template auswählen' },
    { id: 1, name: 'Konfiguration', icon: Settings, description: 'VM-Einstellungen konfigurieren' },
    { id: 2, name: 'Zugriff', icon: Users, description: 'Benutzerzugriff einrichten' },
    { id: 3, name: 'Netzwerk', icon: Network, description: 'Netzwerk konfigurieren' },
    { id: 4, name: 'Übersicht', icon: CheckCircle2, description: 'Überprüfen und deployen' },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDeploy = () => {
    setIsDeploying(true);
    // Simulate deployment
    setTimeout(() => {
      setIsDeploying(false);
      onComplete();
    }, 2000);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-6">
            <div>
              <Label>Application-Template</Label>
              <Select defaultValue="jupyter">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jupyter">Jupyter Notebook</SelectItem>
                  <SelectItem value="gitlab">GitLab Server</SelectItem>
                  <SelectItem value="kubernetes">Kubernetes Cluster</SelectItem>
                  <SelectItem value="jenkins">Jenkins CI/CD</SelectItem>
                  <SelectItem value="postgresql">PostgreSQL Database</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Version</Label>
              <Select defaultValue="3.8">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3.6">3.6 (Stabil)</SelectItem>
                  <SelectItem value="3.7">3.7 (Stabil)</SelectItem>
                  <SelectItem value="3.8">3.8 (Aktuell)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Kurszuweisung</Label>
              <Select defaultValue="cs101">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cs101">CS101 - Informatik 101</SelectItem>
                  <SelectItem value="cs202">CS202 - Software Engineering</SelectItem>
                  <SelectItem value="cs305">CS305 - Cloud Computing</SelectItem>
                  <SelectItem value="cs410">CS410 - Cybersicherheit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="deployment-name">Deployment-Name</Label>
              <Input 
                id="deployment-name"
                placeholder="z.B. CS101-Jupyter-Herbst2024"
                className="mt-2"
                defaultValue="CS101-Jupyter-Fall2024"
              />
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>CPU-Kerne</Label>
                <Select defaultValue="4">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Kerne</SelectItem>
                    <SelectItem value="4">4 Kerne</SelectItem>
                    <SelectItem value="8">8 Kerne</SelectItem>
                    <SelectItem value="16">16 Kerne</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Arbeitsspeicher (RAM)</Label>
                <Select defaultValue="8">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4 GB</SelectItem>
                    <SelectItem value="8">8 GB</SelectItem>
                    <SelectItem value="16">16 GB</SelectItem>
                    <SelectItem value="32">32 GB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Speicher</Label>
                <Select defaultValue="100">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50 GB</SelectItem>
                    <SelectItem value="100">100 GB</SelectItem>
                    <SelectItem value="250">250 GB</SelectItem>
                    <SelectItem value="500">500 GB</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Betriebssystem</Label>
                <Select defaultValue="ubuntu22">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ubuntu20">Ubuntu 20.04 LTS</SelectItem>
                    <SelectItem value="ubuntu22">Ubuntu 22.04 LTS</SelectItem>
                    <SelectItem value="debian11">Debian 11</SelectItem>
                    <SelectItem value="centos8">CentOS 8</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Settings className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-900">Ressourcenschätzung</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Diese Konfiguration verwendet 4 CPU-Kerne, 8 GB RAM und 100 GB Speicher aus Ihrem Kontingent.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Auto-Skalierung</Label>
                <p className="text-xs text-slate-500 mt-1">Ressourcen automatisch basierend auf Last anpassen</p>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Hochverfügbarkeit</Label>
                <p className="text-xs text-slate-500 mt-1">Mit Redundanz deployen für erhöhte Verfügbarkeit</p>
              </div>
              <Switch />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label>Authentifizierungsmethode</Label>
              <Select defaultValue="ldap">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ldap">Universitäts-LDAP</SelectItem>
                  <SelectItem value="ssh">SSH-Keys</SelectItem>
                  <SelectItem value="password">Passwort-Authentifizierung</SelectItem>
                  <SelectItem value="oauth">OAuth 2.0</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>LDAP-Server</Label>
              <Input 
                placeholder="ldap://ldap.university.edu"
                className="mt-2"
                defaultValue="ldap://ldap.university.edu"
              />
            </div>

            <div>
              <Label>Base DN</Label>
              <Input 
                placeholder="dc=university,dc=edu"
                className="mt-2"
                defaultValue="dc=university,dc=edu"
              />
            </div>

            <div>
              <Label>Autorisierte Benutzergruppen</Label>
              <Textarea 
                placeholder="Benutzergruppen eingeben, eine pro Zeile"
                className="mt-2"
                rows={4}
                defaultValue="students-cs101&#10;instructors-cs101&#10;teaching-assistants"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Gastzugriff erlauben</Label>
                <p className="text-xs text-slate-500 mt-1">Temporären Zugriff ohne Authentifizierung erlauben</p>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Zwei-Faktor-Authentifizierung erforderlich</Label>
                <p className="text-xs text-slate-500 mt-1">Zusätzliche Sicherheitsebene hinzufügen</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <Label>Netzwerk</Label>
              <Select defaultValue="private">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Privates Netzwerk</SelectItem>
                  <SelectItem value="public">Öffentliches Netzwerk</SelectItem>
                  <SelectItem value="hybrid">Hybrid-Netzwerk</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Subnetz-Bereich</Label>
              <Input 
                placeholder="10.0.0.0/24"
                className="mt-2"
                defaultValue="10.0.0.0/24"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Öffentliche IP zuweisen</Label>
                <p className="text-xs text-slate-500 mt-1">Deployment über das Internet zugänglich machen</p>
              </div>
              <Switch defaultChecked />
            </div>

            <div>
              <Label>Benutzerdefinierter DNS-Name</Label>
              <div className="flex gap-2 mt-2">
                <Input 
                  placeholder="cs101-jupyter"
                  defaultValue="cs101-jupyter"
                />
                <span className="flex items-center px-3 bg-slate-100 rounded-md text-sm text-slate-600">
                  .lab.university.edu
                </span>
              </div>
            </div>

            <div>
              <Label>Offene Ports</Label>
              <Input 
                placeholder="z.B. 80, 443, 8080"
                className="mt-2"
                defaultValue="80, 443, 8888"
              />
            </div>

            <div>
              <Label>Firewall-Regeln</Label>
              <Textarea 
                placeholder="Benutzerdefinierte Firewall-Regeln"
                className="mt-2"
                rows={4}
                defaultValue="Erlaube HTTP (80) von 10.0.0.0/8&#10;Erlaube HTTPS (443) von überall&#10;Erlaube Jupyter (8888) vom Campus-Netzwerk"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>VPN-Zugriff aktivieren</Label>
                <p className="text-xs text-slate-500 mt-1">Sicheren Remote-Zugriff über Universitäts-VPN erlauben</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="p-6 bg-gradient-to-br from-teal-50 to-blue-50 border border-teal-200 rounded-lg">
              <h3 className="text-slate-900 mb-4">Deployment-Zusammenfassung</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Template:</span>
                  <span className="text-sm text-slate-900">Jupyter Notebook 3.8</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Kurs:</span>
                  <span className="text-sm text-slate-900">CS101 - Informatik 101</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Name:</span>
                  <span className="text-sm text-slate-900">CS101-Jupyter-Fall2024</span>
                </div>
              </div>
            </div>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Ressourcen-Konfiguration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">CPU-Kerne:</span>
                  <Badge variant="secondary">4 Kerne</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Arbeitsspeicher:</span>
                  <Badge variant="secondary">8 GB</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Speicher:</span>
                  <Badge variant="secondary">100 GB</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Betriebssystem:</span>
                  <Badge variant="secondary">Ubuntu 22.04 LTS</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Zugriffs-Konfiguration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Authentifizierung:</span>
                  <Badge variant="secondary">Universitäts-LDAP</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Zwei-Faktor-Auth:</span>
                  <Badge className="bg-green-100 text-green-700">Aktiviert</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Netzwerk-Konfiguration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Netzwerktyp:</span>
                  <Badge variant="secondary">Privates Netzwerk</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">DNS-Name:</span>
                  <span className="text-sm text-slate-900">cs101-jupyter.lab.university.edu</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Offene Ports:</span>
                  <span className="text-sm text-slate-900">80, 443, 8888</span>
                </div>
              </CardContent>
            </Card>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-900">Bereit zum Deployen</p>
                  <p className="text-xs text-amber-700 mt-1">
                    Das Deployment dauert etwa 5-10 Minuten. Sie werden benachrichtigt, wenn es bereit ist.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-slate-900 mb-2">Application deployen</h1>
        <p className="text-slate-600">Konfigurieren und deployen Sie Ihre Application</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = currentStep === index;
          const isCompleted = currentStep > index;

          return (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className={`
                  w-12 h-12 rounded-full flex items-center justify-center transition-all
                  ${isCompleted ? 'bg-teal-500 text-white' : 
                    isActive ? 'bg-teal-500 text-white ring-4 ring-teal-100' : 
                    'bg-slate-100 text-slate-400'}
                `}>
                  {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <p className={`text-sm mt-2 ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                  {step.name}
                </p>
              </div>
              {index < steps.length - 1 && (
                <div className={`h-0.5 flex-1 -mt-6 ${isCompleted ? 'bg-teal-500' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>{steps[currentStep].name}</CardTitle>
          <CardDescription>{steps[currentStep].description}</CardDescription>
        </CardHeader>
        <CardContent>
          {renderStepContent()}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={currentStep === 0 ? onCancel : handlePrevious}
          disabled={isDeploying}
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          {currentStep === 0 ? 'Abbrechen' : 'Zurück'}
        </Button>

        {currentStep < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            Weiter
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            {isDeploying ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Wird deployed...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Application deployen
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
