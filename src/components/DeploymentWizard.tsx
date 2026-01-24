import { useState } from 'react';
import { Check, ChevronRight, ChevronLeft, Server, Settings, Users, Network, CheckCircle2, Zap, Clock } from 'lucide-react';
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
    { id: 1, name: 'Konfiguration', icon: Settings, description: 'VM-Einstellungen (pro VM) konfigurieren' },
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
              <Label>Anzahl VMs</Label>
              <Select defaultValue="4">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                  <SelectItem value="7">7</SelectItem>
                  <SelectItem value="8">8</SelectItem>
                  <SelectItem value="9">9</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="11">11</SelectItem>
                  <SelectItem value="12">12</SelectItem>
                  <SelectItem value="13">13</SelectItem>
                  <SelectItem value="14">14</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="16">16</SelectItem>
                  <SelectItem value="17">17</SelectItem>
                  <SelectItem value="18">18</SelectItem>
                  <SelectItem value="19">19</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="21">21</SelectItem>
                  <SelectItem value="22">22</SelectItem>
                  <SelectItem value="23">23</SelectItem>
                  <SelectItem value="24">24</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="26">26</SelectItem>
                  <SelectItem value="27">27</SelectItem>
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

            <div>
              <Label>Laufzeit</Label>
              <Select defaultValue="3">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Monat</SelectItem>
                  <SelectItem value="3">3 Monate</SelectItem>
                  <SelectItem value="6">6 Monate</SelectItem>
                  <SelectItem value="12">1 Jahr</SelectItem>
                  <SelectItem value="24">2 Jahre</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Nach Ablauf werden die Ressourcen automatisch freigegeben
              </p>
            </div>

            {/* Instant Deployment Section */}
            <div className="mt-8 p-5 bg-gradient-to-br from-teal-50 to-blue-50 border-2 border-teal-300 rounded-lg">
              <div className="flex items-start gap-3 mb-4">
                <Zap className="w-6 h-6 text-teal-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-slate-900 mb-1">Schnell-Deployment</h4>
                  <p className="text-sm text-slate-600">
                    Deployen Sie jetzt mit optimierten Standardeinstellungen basierend auf Ihrem Kurs, 
                    oder konfigurieren Sie detaillierte Einstellungen über den "Weiter"-Button für erweiterte Optionen.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white shadow-md"
                >
                  {isDeploying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Wird deployed...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-2" />
                      Jetzt deployen
                    </>
                  )}
                </Button>
                <div className="flex items-center text-xs text-slate-600 bg-white/60 px-3 py-2 rounded">
                  <Settings className="w-3 h-3 mr-1.5" />
                  Oder "Weiter" für erweiterte Einstellungen
                </div>
              </div>
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            {/* Resource Availability Overview */}
            <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2 mb-4">
                <Server className="w-5 h-5 text-teal-600" />
                <h4 className="text-slate-900">Verfügbare Ressourcen</h4>
              </div>
              <div className="space-y-4">
                {/* CPU */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-700">CPU-Kerne</span>
                    <span className="text-sm text-slate-900">
                      <span className="text-teal-600">12 verfügbar</span> / 16 gesamt
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: '25%' }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">4 Kerne in Benutzung</p>
                </div>

                {/* RAM */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-700">Arbeitsspeicher (RAM)</span>
                    <span className="text-sm text-slate-900">
                      <span className="text-teal-600">24 GB verfügbar</span> / 32 GB gesamt
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: '25%' }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">8 GB in Benutzung</p>
                </div>

                {/* Storage */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-slate-700">Speicher</span>
                    <span className="text-sm text-slate-900">
                      <span className="text-teal-600">650 GB verfügbar</span> / 1000 GB gesamt
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: '35%' }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">350 GB in Benutzung</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>CPU-Kerne</Label>
                <Select defaultValue="4">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Kern</SelectItem>
                    <SelectItem value="2">2 Kerne</SelectItem>
                    <SelectItem value="3">3 Kerne</SelectItem>
                    <SelectItem value="4">4 Kerne</SelectItem>
                    <SelectItem value="5">5 Kerne</SelectItem>
                    <SelectItem value="6">6 Kerne</SelectItem>
                    <SelectItem value="7">7 Kerne</SelectItem>
                    <SelectItem value="8">8 Kerne</SelectItem>
                    <SelectItem value="9">9 Kerne</SelectItem>
                    <SelectItem value="10">10 Kerne</SelectItem>
                    <SelectItem value="11">11 Kerne</SelectItem>
                    <SelectItem value="12">12 Kerne</SelectItem>
                    <SelectItem value="13">13 Kerne</SelectItem>
                    <SelectItem value="14">14 Kerne</SelectItem>
                    <SelectItem value="15">15 Kerne</SelectItem>
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
                    <SelectItem value="1">1 GB</SelectItem>
                    <SelectItem value="2">2 GB</SelectItem>
                    <SelectItem value="3">3 GB</SelectItem>
                    <SelectItem value="4">4 GB</SelectItem>
                    <SelectItem value="5">5 GB</SelectItem>
                    <SelectItem value="6">6 GB</SelectItem>
                    <SelectItem value="7">7 GB</SelectItem>
                    <SelectItem value="8">8 GB</SelectItem>
                    <SelectItem value="9">9 GB</SelectItem>
                    <SelectItem value="10">10 GB</SelectItem>
                    <SelectItem value="11">11 GB</SelectItem>
                    <SelectItem value="12">12 GB</SelectItem>
                    <SelectItem value="13">13 GB</SelectItem>
                    <SelectItem value="14">14 GB</SelectItem>
                    <SelectItem value="15">15 GB</SelectItem>
                    <SelectItem value="16">16 GB</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Speicher</Label>
                <Select defaultValue="8">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 GB</SelectItem>
                    <SelectItem value="2">2 GB</SelectItem>
                    <SelectItem value="3">3 GB</SelectItem>
                    <SelectItem value="4">4 GB</SelectItem>
                    <SelectItem value="5">5 GB</SelectItem>
                    <SelectItem value="6">6 GB</SelectItem>
                    <SelectItem value="7">7 GB</SelectItem>
                    <SelectItem value="8">8 GB</SelectItem>
                    <SelectItem value="9">9 GB</SelectItem>
                    <SelectItem value="10">10 GB</SelectItem>
                    <SelectItem value="11">11 GB</SelectItem>
                    <SelectItem value="12">12 GB</SelectItem>
                    <SelectItem value="13">13 GB</SelectItem>
                    <SelectItem value="14">14 GB</SelectItem>
                    <SelectItem value="15">15 GB</SelectItem>
                    <SelectItem value="16">16 GB</SelectItem>
                    <SelectItem value="64">50 GB</SelectItem>
                    <SelectItem value="128">100 GB</SelectItem>
                    <SelectItem value="256">250 GB</SelectItem>
                    <SelectItem value="512">500 GB</SelectItem>
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
                    <SelectItem value="opnsense">OpnSense 24.7</SelectItem>
                    <SelectItem value="rocky">Rocky 9.3</SelectItem>
                    <SelectItem value="pfsense">Pfsense 2.6</SelectItem>
                    <SelectItem value="windows11">Windows 11 qcow</SelectItem>
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
                    Diese Konfiguration verwendet 4 CPU-Kerne, 8 GB RAM und 128 GB Speicher aus Ihrem Kontingent.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label>Authentifizierungsmethode</Label>
              <Select defaultValue="password">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="password">Passwort-Authentifizierung (Studenten erhalten Zugangdaten per Mail)</SelectItem>
                  <SelectItem value="sso">Login über DHBW SSO</SelectItem>
                  <SelectItem value="ssh">SSH-Keys</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Autorisierte Benutzergruppen</Label>
              <Textarea 
                placeholder="Benutzergruppen eingeben, eine pro Zeile"
                className="mt-2"
                rows={4}
                defaultValue="students-cs101&#10;instructors-cs101&#10;"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Dozentenzugriff einrichten</Label>
                <p className="text-xs text-slate-500 mt-1">Zugang einrichten mit dem der Dozent auf alle VMs zugreifen kann</p>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Starke Passwörter</Label>
                <p className="text-xs text-slate-500 mt-1">Es werden standardmäßig starke Passwörter gesetzt, die von den Studierenden nicht geändert werden müssen</p>
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
              <Select defaultValue="dhbwnet">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dhbwnet">DHBW</SelectItem>
                  <SelectItem value="nat">NAT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Subnetz-Bereich</Label>
              <Select defaultValue="ext">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ext">ext_subnet</SelectItem>
                  <SelectItem value="ext2">ext_subnet2</SelectItem>
                  <SelectItem value="extnat">ext_nat_subnet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Security-Policy</Label>
              <Select defaultValue="basic">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="basic">Standard</SelectItem>
                  <SelectItem value="adv">Erweitert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Offene Ports</Label>
              <Input 
                placeholder="z.B. 80, 443, 8080"
                className="mt-2"
                defaultValue="80, 443, 8888"
              />
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
                <CardTitle className="text-base">Ressourcen-Konfiguration (kumulierte Werte)</CardTitle>
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
                  <Badge variant="secondary">Passwort-Authentifizierung</Badge>
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
                  <Badge variant="secondary">DHBW</Badge>
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