import { Settings, RefreshCw, CheckCircle2, AlertCircle, Server, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { useState } from 'react';

export function OpenStackConfig() {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'testing'>('connected');

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
        <h1 className="text-slate-900 mb-2">OpenStack Konfiguration</h1>
        <p className="text-slate-600">Verwalten Sie Ihre OpenStack-Verbindungseinstellungen und Quotas</p>
      </div>

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
    </div>
  );
}
