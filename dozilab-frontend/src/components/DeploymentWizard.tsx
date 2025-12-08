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
    { id: 0, name: 'Template', icon: Server, description: 'Select application template' },
    { id: 1, name: 'Configuration', icon: Settings, description: 'Configure VM settings' },
    { id: 2, name: 'Access', icon: Users, description: 'Set up user access' },
    { id: 3, name: 'Network', icon: Network, description: 'Configure networking' },
    { id: 4, name: 'Review', icon: CheckCircle2, description: 'Review and deploy' },
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
              <Label>Application Template</Label>
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
                  <SelectItem value="3.6">3.6 (Stable)</SelectItem>
                  <SelectItem value="3.7">3.7 (Stable)</SelectItem>
                  <SelectItem value="3.8">3.8 (Latest)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Course Assignment</Label>
              <Select defaultValue="cs101">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cs101">CS101 - Computer Science 101</SelectItem>
                  <SelectItem value="cs202">CS202 - Software Engineering</SelectItem>
                  <SelectItem value="cs305">CS305 - Cloud Computing</SelectItem>
                  <SelectItem value="cs410">CS410 - Cybersecurity</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="deployment-name">Deployment Name</Label>
              <Input 
                id="deployment-name"
                placeholder="e.g., CS101-Jupyter-Fall2024"
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
                <Label>CPU Cores</Label>
                <Select defaultValue="4">
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2 Cores</SelectItem>
                    <SelectItem value="4">4 Cores</SelectItem>
                    <SelectItem value="8">8 Cores</SelectItem>
                    <SelectItem value="16">16 Cores</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Memory (RAM)</Label>
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
                <Label>Storage</Label>
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
                <Label>Operating System</Label>
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
                  <p className="text-sm text-blue-900">Resource Estimate</p>
                  <p className="text-xs text-blue-700 mt-1">
                    This configuration will use 4 CPU cores, 8GB RAM, and 100GB storage from your quota.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Auto-scaling</Label>
                <p className="text-xs text-slate-500 mt-1">Automatically adjust resources based on load</p>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>High Availability</Label>
                <p className="text-xs text-slate-500 mt-1">Deploy with redundancy for increased uptime</p>
              </div>
              <Switch />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label>Authentication Method</Label>
              <Select defaultValue="ldap">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ldap">University LDAP</SelectItem>
                  <SelectItem value="ssh">SSH Keys</SelectItem>
                  <SelectItem value="password">Password Authentication</SelectItem>
                  <SelectItem value="oauth">OAuth 2.0</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>LDAP Server</Label>
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
              <Label>Authorized User Groups</Label>
              <Textarea 
                placeholder="Enter user groups, one per line"
                className="mt-2"
                rows={4}
                defaultValue="students-cs101&#10;instructors-cs101&#10;teaching-assistants"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Allow Guest Access</Label>
                <p className="text-xs text-slate-500 mt-1">Permit temporary access without authentication</p>
              </div>
              <Switch />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Require Multi-Factor Authentication</Label>
                <p className="text-xs text-slate-500 mt-1">Add an extra layer of security</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <Label>Network</Label>
              <Select defaultValue="private">
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private Network</SelectItem>
                  <SelectItem value="public">Public Network</SelectItem>
                  <SelectItem value="hybrid">Hybrid Network</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Subnet Range</Label>
              <Input 
                placeholder="10.0.0.0/24"
                className="mt-2"
                defaultValue="10.0.0.0/24"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Assign Public IP</Label>
                <p className="text-xs text-slate-500 mt-1">Make deployment accessible from the internet</p>
              </div>
              <Switch defaultChecked />
            </div>

            <div>
              <Label>Custom DNS Name</Label>
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
              <Label>Open Ports</Label>
              <Input 
                placeholder="e.g., 80, 443, 8080"
                className="mt-2"
                defaultValue="80, 443, 8888"
              />
            </div>

            <div>
              <Label>Firewall Rules</Label>
              <Textarea 
                placeholder="Custom firewall rules"
                className="mt-2"
                rows={4}
                defaultValue="Allow HTTP (80) from 10.0.0.0/8&#10;Allow HTTPS (443) from anywhere&#10;Allow Jupyter (8888) from campus network"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Enable VPN Access</Label>
                <p className="text-xs text-slate-500 mt-1">Allow secure remote access via university VPN</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="p-6 bg-gradient-to-br from-teal-50 to-blue-50 border border-teal-200 rounded-lg">
              <h3 className="text-slate-900 mb-4">Deployment Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Template:</span>
                  <span className="text-sm text-slate-900">Jupyter Notebook 3.8</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Course:</span>
                  <span className="text-sm text-slate-900">CS101 - Computer Science 101</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">Name:</span>
                  <span className="text-sm text-slate-900">CS101-Jupyter-Fall2024</span>
                </div>
              </div>
            </div>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Resource Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">CPU Cores:</span>
                  <Badge variant="secondary">4 cores</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Memory:</span>
                  <Badge variant="secondary">8 GB</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Storage:</span>
                  <Badge variant="secondary">100 GB</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Operating System:</span>
                  <Badge variant="secondary">Ubuntu 22.04 LTS</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Access Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Authentication:</span>
                  <Badge variant="secondary">University LDAP</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Multi-Factor Auth:</span>
                  <Badge className="bg-green-100 text-green-700">Enabled</Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Network Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Network Type:</span>
                  <Badge variant="secondary">Private Network</Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">DNS Name:</span>
                  <span className="text-sm text-slate-900">cs101-jupyter.lab.university.edu</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Open Ports:</span>
                  <span className="text-sm text-slate-900">80, 443, 8888</span>
                </div>
              </CardContent>
            </Card>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm text-amber-900">Ready to Deploy</p>
                  <p className="text-xs text-amber-700 mt-1">
                    The deployment will take approximately 5-10 minutes. You will be notified when it's ready.
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
        <h1 className="text-slate-900 mb-2">Deploy Application</h1>
        <p className="text-slate-600">Configure and deploy your application</p>
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
          {currentStep === 0 ? 'Cancel' : 'Previous'}
        </Button>

        {currentStep < steps.length - 1 ? (
          <Button
            onClick={handleNext}
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            Next
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
                Deploying...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Deploy Application
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
