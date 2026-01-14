import { Settings, RefreshCw, CheckCircle2, AlertCircle, Server, Eye, EyeOff, Shield, Lock, Workflow, FileCode, Cpu, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Textarea } from './ui/textarea';
import { useState } from 'react';

export function OpenStackConfig() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('connected');
  const [settingsMode, setSettingsMode] = useState<'general' | 'admin'>('general');
  
  // Admin-Einstellungen States
  const [autoApproveTemplates, setAutoApproveTemplates] = useState(false);
  const [encryptSecrets, setEncryptSecrets] = useState(true);
  const [autoImageCreation, setAutoImageCreation] = useState(false);
  const [enforceMinPrivilege, setEnforceMinPrivilege] = useState(true);

  const handleTestConnection = () => {
    setConnectionStatus('testing');
    setTimeout(() => {
      setConnectionStatus('connected');
    }, 2000);
  };

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-slate-900 mb-2">Einstellungen</h1>
        <p className="text-slate-600">Verwalten Sie Ihre OpenStack-Konfiguration und Systemeinstellungen</p>
      </div>

      {/* Toggle für Generell/Admin */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Settings className="w-5 h-5 text-slate-600" />
              <div>
                <p className="text-slate-900">Einstellungsmodus</p>
                <p className="text-sm text-slate-500">
                  Wählen Sie zwischen allgemeinen und administrativen Einstellungen
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setSettingsMode('general')}
                className={`px-6 py-2 rounded-md transition-all ${
                  settingsMode === 'general'
                    ? 'bg-white text-teal-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Generell
              </button>
              <button
                onClick={() => setSettingsMode('admin')}
                className={`px-6 py-2 rounded-md transition-all ${
                  settingsMode === 'admin'
                    ? 'bg-white text-teal-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Shield className="w-4 h-4 inline mr-2" />
                Admin
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generelle Einstellungen */}
      {settingsMode === 'general' && (
        <>
          {/* Connection Status Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center
                    ${connectionStatus === 'connected' ? 'bg-green-100' : 
                      connectionStatus === 'testing' ? 'bg-blue-100' : 'bg-red-100'}
                  `}>
                    {connectionStatus === 'connected' ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : connectionStatus === 'testing' ? (
                      <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-slate-900">Verbindungsstatus</p>
                    <p className="text-sm text-slate-500">
                      {connectionStatus === 'connected' ? 'Mit OpenStack verbunden' :
                       connectionStatus === 'testing' ? 'Verbindung wird getestet...' : 'Nicht verbunden'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge 
                    className={
                      connectionStatus === 'connected' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                      connectionStatus === 'testing' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                      'bg-red-100 text-red-700 hover:bg-red-100'
                    }
                  >
                    {connectionStatus === 'connected' ? 'Aktiv' :
                     connectionStatus === 'testing' ? 'Testend' : 'Inaktiv'}
                  </Badge>
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={connectionStatus === 'testing'}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${connectionStatus === 'testing' ? 'animate-spin' : ''}`} />
                    Verbindung testen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Authentication Settings */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Authentifizierung
                </CardTitle>
                <CardDescription>OpenStack API-Zugangsdaten</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="auth-url">Authentifizierungs-URL</Label>
                  <Input 
                    id="auth-url"
                    className="mt-2"
                    defaultValue="https://openstack.university.edu:5000/v3"
                  />
                </div>

                <div>
                  <Label htmlFor="project-name">Projektname</Label>
                  <Input 
                    id="project-name"
                    className="mt-2"
                    defaultValue="DoziLab-Production"
                  />
                </div>

                <div>
                  <Label htmlFor="domain">Domain</Label>
                  <Input 
                    id="domain"
                    className="mt-2"
                    defaultValue="default"
                  />
                </div>

                <div>
                  <Label htmlFor="username">Benutzername</Label>
                  <Input 
                    id="username"
                    className="mt-2"
                    defaultValue="admin"
                  />
                </div>

                <div>
                  <Label htmlFor="password">Passwort</Label>
                  <div className="relative mt-2">
                    <Input 
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      defaultValue="supersecretpassword"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="api-key">API-Key (Optional)</Label>
                  <div className="relative mt-2">
                    <Input 
                      id="api-key"
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="API-Key eingeben, falls Key-basierte Auth verwendet wird"
                      defaultValue="sk-1234567890abcdef"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button className="w-full bg-teal-500 hover:bg-teal-600 text-white">
                  Zugangsdaten speichern
                </Button>
              </CardContent>
            </Card>

            {/* Endpoints & Quotas */}
            <div className="space-y-6">
              {/* Service Endpoints */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    Service-Endpunkte
                  </CardTitle>
                  <CardDescription>OpenStack-Serviceendpunkte</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="compute">Compute (Nova)</Label>
                    <Input 
                      id="compute"
                      className="mt-2"
                      defaultValue="https://openstack.university.edu:8774/v2.1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="network">Netzwerk (Neutron)</Label>
                    <Input 
                      id="network"
                      className="mt-2"
                      defaultValue="https://openstack.university.edu:9696"
                    />
                  </div>

                  <div>
                    <Label htmlFor="storage">Block Storage (Cinder)</Label>
                    <Input 
                      id="storage"
                      className="mt-2"
                      defaultValue="https://openstack.university.edu:8776/v3"
                    />
                  </div>

                  <div>
                    <Label htmlFor="image">Image (Glance)</Label>
                    <Input 
                      id="image"
                      className="mt-2"
                      defaultValue="https://openstack.university.edu:9292"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Resource Quotas */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Ressourcen-Quotas</CardTitle>
                  <CardDescription>Aktuelle Zuteilungslimits</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600">CPU-Kerne</span>
                      <Badge variant="outline">64 Kerne</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600">Arbeitsspeicher</span>
                      <Badge variant="outline">192 GB</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600">Speicher</span>
                      <Badge variant="outline">3.0 TB</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600">VM-Instanzen</span>
                      <Badge variant="outline">25 Instanzen</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600">Floating IPs</span>
                      <Badge variant="outline">10 IPs</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600">Security Groups</span>
                      <Badge variant="outline">15 Gruppen</Badge>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full">
                    Quota-Erhöhung anfordern
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Additional Settings */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Erweiterte Einstellungen</CardTitle>
              <CardDescription>Zusätzliche Konfigurationsoptionen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="region">Region</Label>
                  <Input 
                    id="region"
                    className="mt-2"
                    defaultValue="RegionOne"
                  />
                </div>

                <div>
                  <Label htmlFor="availability-zone">Availability Zone</Label>
                  <Input 
                    id="availability-zone"
                    className="mt-2"
                    defaultValue="nova"
                  />
                </div>

                <div>
                  <Label htmlFor="timeout">Verbindungszeitüberschreitung (Sekunden)</Label>
                  <Input 
                    id="timeout"
                    type="number"
                    className="mt-2"
                    defaultValue="30"
                  />
                </div>

                <div>
                  <Label htmlFor="retry">Wiederholversuche</Label>
                  <Input 
                    id="retry"
                    type="number"
                    className="mt-2"
                    defaultValue="3"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button className="bg-teal-500 hover:bg-teal-600 text-white">
                  Alle Einstellungen speichern
                </Button>
                <Button variant="outline">
                  Auf Standardeinstellungen zurücksetzen
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Admin-Spezifische Einstellungen */}
      {settingsMode === 'admin' && (
        <>
          {/* Connection Status Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center
                    ${connectionStatus === 'connected' ? 'bg-green-100' : 
                      connectionStatus === 'testing' ? 'bg-blue-100' : 'bg-red-100'}
                  `}>
                    {connectionStatus === 'connected' ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : connectionStatus === 'testing' ? (
                      <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-slate-900">Verbindungsstatus</p>
                    <p className="text-sm text-slate-500">
                      {connectionStatus === 'connected' ? 'Mit OpenStack verbunden' :
                       connectionStatus === 'testing' ? 'Verbindung wird getestet...' : 'Nicht verbunden'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge 
                    className={
                      connectionStatus === 'connected' ? 'bg-green-100 text-green-700 hover:bg-green-100' :
                      connectionStatus === 'testing' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                      'bg-red-100 text-red-700 hover:bg-red-100'
                    }
                  >
                    {connectionStatus === 'connected' ? 'Aktiv' :
                     connectionStatus === 'testing' ? 'Testend' : 'Inaktiv'}
                  </Badge>
                  <Button
                    variant="outline"
                    onClick={handleTestConnection}
                    disabled={connectionStatus === 'testing'}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${connectionStatus === 'testing' ? 'animate-spin' : ''}`} />
                    Verbindung testen
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Authentication Settings */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Authentifizierung
                </CardTitle>
                <CardDescription>OpenStack API-Zugangsdaten</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="auth-url">Authentifizierungs-URL</Label>
                  <Input 
                    id="auth-url"
                    className="mt-2"
                    defaultValue="https://openstack.university.edu:5000/v3"
                  />
                </div>

                <div>
                  <Label htmlFor="project-name">Projektname</Label>
                  <Input 
                    id="project-name"
                    className="mt-2"
                    defaultValue="DoziLab-Production"
                  />
                </div>

                <div>
                  <Label htmlFor="domain">Domain</Label>
                  <Input 
                    id="domain"
                    className="mt-2"
                    defaultValue="default"
                  />
                </div>

                <div>
                  <Label htmlFor="username">Benutzername</Label>
                  <Input 
                    id="username"
                    className="mt-2"
                    defaultValue="admin"
                  />
                </div>

                <div>
                  <Label htmlFor="password">Passwort</Label>
                  <div className="relative mt-2">
                    <Input 
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      defaultValue="supersecretpassword"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="api-key">API-Key (Optional)</Label>
                  <div className="relative mt-2">
                    <Input 
                      id="api-key"
                      type={showApiKey ? 'text' : 'password'}
                      placeholder="API-Key eingeben, falls Key-basierte Auth verwendet wird"
                      defaultValue="sk-1234567890abcdef"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button className="w-full bg-teal-500 hover:bg-teal-600 text-white">
                  Zugangsdaten speichern
                </Button>
              </CardContent>
            </Card>

            {/* Endpoints & Quotas */}
            <div className="space-y-6">
              {/* Service Endpoints */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    Service-Endpunkte
                  </CardTitle>
                  <CardDescription>OpenStack-Serviceendpunkte</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="compute">Compute (Nova)</Label>
                    <Input 
                      id="compute"
                      className="mt-2"
                      defaultValue="https://openstack.university.edu:8774/v2.1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="network">Netzwerk (Neutron)</Label>
                    <Input 
                      id="network"
                      className="mt-2"
                      defaultValue="https://openstack.university.edu:9696"
                    />
                  </div>

                  <div>
                    <Label htmlFor="storage">Block Storage (Cinder)</Label>
                    <Input 
                      id="storage"
                      className="mt-2"
                      defaultValue="https://openstack.university.edu:8776/v3"
                    />
                  </div>

                  <div>
                    <Label htmlFor="image">Image (Glance)</Label>
                    <Input 
                      id="image"
                      className="mt-2"
                      defaultValue="https://openstack.university.edu:9292"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Resource Quotas */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Ressourcen-Quotas</CardTitle>
                  <CardDescription>Aktuelle Zuteilungslimits</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600">CPU-Kerne</span>
                      <Badge variant="outline">64 Kerne</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600">Arbeitsspeicher</span>
                      <Badge variant="outline">192 GB</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600">Speicher</span>
                      <Badge variant="outline">3.0 TB</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600">VM-Instanzen</span>
                      <Badge variant="outline">25 Instanzen</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600">Floating IPs</span>
                      <Badge variant="outline">10 IPs</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600">Security Groups</span>
                      <Badge variant="outline">15 Gruppen</Badge>
                    </div>
                  </div>

                  <Button variant="outline" className="w-full">
                    Quota-Erhöhung anfordern
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Admin-Einstellungen */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Admin-Einstellungen</CardTitle>
              <CardDescription>Zusätzliche Konfigurationsoptionen für Administratoren</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="region">Region</Label>
                  <Input 
                    id="region"
                    className="mt-2"
                    defaultValue="RegionOne"
                  />
                </div>

                <div>
                  <Label htmlFor="availability-zone">Availability Zone</Label>
                  <Input 
                    id="availability-zone"
                    className="mt-2"
                    defaultValue="nova"
                  />
                </div>

                <div>
                  <Label htmlFor="timeout">Verbindungszeitüberschreitung (Sekunden)</Label>
                  <Input 
                    id="timeout"
                    type="number"
                    className="mt-2"
                    defaultValue="30"
                  />
                </div>

                <div>
                  <Label htmlFor="retry">Wiederholversuche</Label>
                  <Input 
                    id="retry"
                    type="number"
                    className="mt-2"
                    defaultValue="3"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <Button className="bg-teal-500 hover:bg-teal-600 text-white">
                  Alle Einstellungen speichern
                </Button>
                <Button variant="outline">
                  Auf Standardeinstellungen zurücksetzen
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Admin-Spezifische Einstellungen */}
          <div className="space-y-6">
            {/* Template Approval Workflow */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Workflow className="w-5 h-5" />
                  Template-Genehmigungsworkflow
                </CardTitle>
                <CardDescription>
                  Verwalten Sie den Prozess für die Freigabe neuer Templates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-slate-900">Automatische Genehmigung</p>
                    <p className="text-sm text-slate-500">
                      Templates automatisch ohne manuelle Überprüfung freigeben
                    </p>
                  </div>
                  <Switch
                    checked={autoApproveTemplates}
                    onCheckedChange={setAutoApproveTemplates}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Ressourcen-Prüfschwellen für Genehmigung</Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="max-cpu-threshold" className="text-sm text-slate-600">
                        Max. CPU-Kerne
                      </Label>
                      <Input
                        id="max-cpu-threshold"
                        type="number"
                        className="mt-2"
                        defaultValue="8"
                        placeholder="Max. CPU-Kerne"
                      />
                    </div>
                    <div>
                      <Label htmlFor="max-ram-threshold" className="text-sm text-slate-600">
                        Max. RAM (GB)
                      </Label>
                      <Input
                        id="max-ram-threshold"
                        type="number"
                        className="mt-2"
                        defaultValue="16"
                        placeholder="Max. RAM (GB)"
                      />
                    </div>
                    <div>
                      <Label htmlFor="max-gpu-threshold" className="text-sm text-slate-600">
                        Max. GPU-Einheiten
                      </Label>
                      <Input
                        id="max-gpu-threshold"
                        type="number"
                        className="mt-2"
                        defaultValue="1"
                        placeholder="Max. GPU"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-slate-500">
                    Templates, die diese Schwellen überschreiten, benötigen manuelle Genehmigung
                  </p>
                </div>

                <div>
                  <Label htmlFor="approval-email">Benachrichtigungs-E-Mail für Genehmigungen</Label>
                  <Input
                    id="approval-email"
                    type="email"
                    className="mt-2"
                    defaultValue="admin@university.edu"
                    placeholder="admin@university.edu"
                  />
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex gap-3">
                    <Workflow className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-900">Workflow-Status</p>
                      <p className="text-sm text-blue-700 mt-1">
                        Genehmigungsworkflow aktiv · 3 Templates warten auf Freigabe
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Security & Secrets Management */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Sicherheit & Secrets-Verwaltung
                </CardTitle>
                <CardDescription>
                  Konfiguration für verschlüsselte Speicherung und sichere API-Nutzung
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-slate-900">Verschlüsselte Secrets-Speicherung</p>
                    <p className="text-sm text-slate-500">
                      Alle Zugangsdaten werden verschlüsselt gespeichert (kein Client-Side-Storage)
                    </p>
                  </div>
                  <Switch
                    checked={encryptSecrets}
                    onCheckedChange={setEncryptSecrets}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-slate-900">Prinzip der minimalen Berechtigung</p>
                    <p className="text-sm text-slate-500">
                      OpenStack-APIs nur mit minimalen erforderlichen Rechten nutzen
                    </p>
                  </div>
                  <Switch
                    checked={enforceMinPrivilege}
                    onCheckedChange={setEnforceMinPrivilege}
                  />
                </div>

                <div>
                  <Label htmlFor="encryption-key">Verschlüsselungs-Algorithmus</Label>
                  <Input
                    id="encryption-key"
                    className="mt-2"
                    defaultValue="AES-256-GCM"
                    disabled
                  />
                  <p className="text-sm text-slate-500 mt-1">
                    Industriestandard-Verschlüsselung für maximale Sicherheit
                  </p>
                </div>

                <div>
                  <Label htmlFor="key-rotation">Schlüsselrotation (Tage)</Label>
                  <Input
                    id="key-rotation"
                    type="number"
                    className="mt-2"
                    defaultValue="90"
                    placeholder="Tage bis zur automatischen Rotation"
                  />
                </div>

                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-green-900">Sicherheitsstatus</p>
                      <p className="text-sm text-green-700 mt-1">
                        Alle Secrets verschlüsselt · Kein Client-Side-Storage · OpenStack-Policies konform
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Automated Base Image Creation */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCode className="w-5 h-5" />
                  Automatisierte Basis-Image-Erstellung
                </CardTitle>
                <CardDescription>
                  Automatisierung für die Erstellung klonbarer VM-Templates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-slate-900">Automatische Image-Erstellung aktivieren</p>
                    <p className="text-sm text-slate-500">
                      Basis-VMs werden automatisch als klonbare Templates gespeichert
                    </p>
                  </div>
                  <Switch
                    checked={autoImageCreation}
                    onCheckedChange={setAutoImageCreation}
                  />
                </div>

                <div>
                  <Label htmlFor="automation-script">Automatisierungsskript-Pfad</Label>
                  <Input
                    id="automation-script"
                    className="mt-2"
                    defaultValue="/opt/dozilab/scripts/create-base-image.sh"
                    placeholder="Pfad zum Automatisierungsskript"
                  />
                </div>

                <div>
                  <Label htmlFor="base-image-template">Basis-Template-Konfiguration</Label>
                  <Textarea
                    id="base-image-template"
                    className="mt-2 font-mono text-sm"
                    rows={6}
                    defaultValue={`# Base Image Automation Config
image_format: qcow2
snapshot_enabled: true
clone_template: true
auto_optimize: true
cleanup_after_build: true`}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="image-retention" className="text-sm text-slate-600">
                      Image-Aufbewahrung (Tage)
                    </Label>
                    <Input
                      id="image-retention"
                      type="number"
                      className="mt-2"
                      defaultValue="365"
                    />
                  </div>
                  <div>
                    <Label htmlFor="max-concurrent-builds" className="text-sm text-slate-600">
                      Max. gleichzeitige Builds
                    </Label>
                    <Input
                      id="max-concurrent-builds"
                      type="number"
                      className="mt-2"
                      defaultValue="3"
                    />
                  </div>
                </div>

                <Button variant="outline" className="w-full">
                  <FileCode className="w-4 h-4 mr-2" />
                  Automatisierungsskript testen
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="flex gap-3">
            <Button className="bg-teal-500 hover:bg-teal-600 text-white">
              Alle Admin-Einstellungen speichern
            </Button>
            <Button variant="outline">
              Auf Standardeinstellungen zurücksetzen
            </Button>
          </div>
        </>
      )}
    </div>
  );
}