import { Settings, RefreshCw, CheckCircle2, AlertCircle, Server, Eye, EyeOff, Shield, Lock, Workflow, FileCode, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { useState, useEffect } from 'react';
import {
  listOpenstackProjects,
  getOpenstackProject,
  createOpenstackProject,
  updateOpenstackProject,
  deleteOpenstackProject,
  type OpenstackProjectResponse,
  type OpenstackCredentialsCreate,
} from '../api/openstackProjects';
import { getQuotas, type QuotasResponse } from '../api/quotas';
import { GithubIntegrationCard } from '../components/GithubIntegrationCard';

const percent = (used?: number, limit?: number) => {
  if (!used || !limit || limit === 0) return 0;
  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)));
};

const formatGB = (v?: number) => {
  if (v == null) return '—';
  return v >= 1024 ? `${(v / 1024).toFixed(1)} TB` : `${v} GB`;
};

const formatMBasGB = (v?: number) => {
  if (v == null) return '—';
  return `${Math.round(v / 1024)} GB`;
};

export function OpenStackConfig() {
  const [showPassword, setShowPassword] = useState(false);
  const [settingsMode, setSettingsMode] = useState<'general' | 'admin'>('general');

  // Admin-Einstellungen States
  const [autoApproveTemplates, setAutoApproveTemplates] = useState(false);
  const [encryptSecrets, setEncryptSecrets] = useState(true);
  const [autoImageCreation, setAutoImageCreation] = useState(false);
  const [enforceMinPrivilege, setEnforceMinPrivilege] = useState(true);

  // Credentials state
  const [existingProject, setExistingProject] = useState<OpenstackProjectResponse | null>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [form, setForm] = useState<OpenstackCredentialsCreate>({
    auth_url: '',
    username: '',
    password: '',
    user_domain_name: 'Default',
    region_name: '',
    openstack_project_id: '',
    openstack_project_name: '',
  });

  // Quotas state
  const [quotas, setQuotas] = useState<QuotasResponse | null>(null);
  const [quotasLoading, setQuotasLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    listOpenstackProjects()
      .then(async (projects) => {
        if (!mounted || projects.length === 0) return;
        const p = projects[0];
        setExistingProject(p);
        // Fetch full credentials (includes auth_url, username masked)
        const creds = await getOpenstackProject(p.id);
        if (!mounted) return;
        setForm((prev) => ({
          ...prev,
          auth_url: creds.auth_url,
          username: creds.username,
          region_name: creds.region_name,
          openstack_project_id: creds.openstack_project_id,
          openstack_project_name: creds.openstack_project_name,
          user_domain_name: creds.user_domain_name,
        }));
      })
      .catch(() => {/* no credentials yet */})
      .finally(() => { if (mounted) setCredentialsLoading(false); });

    getQuotas()
      .then((data) => { if (mounted) setQuotas(data); })
      .catch(() => {/* ignore */})
      .finally(() => { if (mounted) setQuotasLoading(false); });

    return () => { mounted = false; };
  }, []);

  const set = (field: keyof OpenstackCredentialsCreate) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.password.trim() && existingProject) {
      setSaveError('Bitte geben Sie das Passwort ein, um die Zugangsdaten zu aktualisieren.');
      return;
    }
    setSaveError(null);
    setSaveSuccess(false);
    setSaveLoading(true);
    try {
      if (existingProject) {
        await updateOpenstackProject(existingProject.id, form);
      } else {
        await createOpenstackProject(form);
      }
      setSaveSuccess(true);
      setForm((prev) => ({ ...prev, password: '' }));
      // Refresh project list to get updated data
      const projects = await listOpenstackProjects();
      if (projects.length > 0) setExistingProject(projects[0]);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Fehler beim Speichern der Zugangsdaten');
    } finally {
      setSaveLoading(false);
    }
  };

  const connectionStatus = existingProject ? 'connected' : 'disconnected';

  const handleDeleteProject = async () => {
    if (!existingProject) return;
    setDeleteLoading(true);
    try {
      await deleteOpenstackProject(existingProject.id);
      setExistingProject(null);
      setForm({ auth_url: '', username: '', password: '', user_domain_name: 'Default', region_name: '', openstack_project_id: '', openstack_project_name: '' });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Fehler beim Löschen des Projekts');
    } finally {
      setDeleteLoading(false);
    }
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
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    credentialsLoading ? 'bg-slate-100' :
                    connectionStatus === 'connected' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {credentialsLoading ? (
                      <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
                    ) : connectionStatus === 'connected' ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-slate-900">Verbindungsstatus</p>
                    <p className="text-sm text-slate-500">
                      {credentialsLoading ? 'Wird geprüft...' :
                       connectionStatus === 'connected'
                         ? `Verbunden mit Projekt: ${existingProject?.openstack_project_name}`
                         : 'Keine Zugangsdaten hinterlegt'}
                    </p>
                  </div>
                </div>
                <Badge
                  className={
                    credentialsLoading ? 'bg-slate-100 text-slate-600' :
                    connectionStatus === 'connected'
                      ? 'bg-green-100 text-green-700 hover:bg-green-100'
                      : 'bg-red-100 text-red-700 hover:bg-red-100'
                  }
                >
                  {credentialsLoading ? 'Prüft...' :
                   connectionStatus === 'connected' ? 'Aktiv' : 'Nicht verbunden'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* GitHub-Integration */}
          <GithubIntegrationCard />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Authentication Settings */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Authentifizierung
                </CardTitle>
                <CardDescription>
                  {existingProject ? 'OpenStack-Zugangsdaten aktualisieren' : 'OpenStack-Zugangsdaten hinterlegen'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveCredentials} className="space-y-4">
                  {saveError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                      {saveError}
                    </div>
                  )}
                  {saveSuccess && (
                    <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
                      Zugangsdaten erfolgreich gespeichert.
                    </div>
                  )}

                  <div>
                    <Label htmlFor="auth-url">Authentifizierungs-URL</Label>
                    <Input
                      id="auth-url"
                      className="mt-2"
                      placeholder="https://openstack.example.com:5000/v3"
                      value={form.auth_url}
                      onChange={set('auth_url')}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="project-id">Projekt-ID</Label>
                      <Input
                        id="project-id"
                        className="mt-2"
                        placeholder="abc123..."
                        value={form.openstack_project_id}
                        onChange={set('openstack_project_id')}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="project-name">Projektname</Label>
                      <Input
                        id="project-name"
                        className="mt-2"
                        placeholder="mein-projekt"
                        value={form.openstack_project_name}
                        onChange={set('openstack_project_name')}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="region">Region</Label>
                      <Input
                        id="region"
                        className="mt-2"
                        placeholder="RegionOne"
                        value={form.region_name}
                        onChange={set('region_name')}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="domain">User Domain</Label>
                      <Input
                        id="domain"
                        className="mt-2"
                        placeholder="Default"
                        value={form.user_domain_name}
                        onChange={set('user_domain_name')}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="username">Benutzername</Label>
                    <Input
                      id="username"
                      className="mt-2"
                      placeholder={existingProject ? '(gespeichert, zum Ändern neu eingeben)' : 'OpenStack-Benutzername'}
                      value={form.username}
                      onChange={set('username')}
                      required={!existingProject}
                    />
                  </div>

                  <div>
                    <Label htmlFor="password">Passwort</Label>
                    <div className="relative mt-2">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder={existingProject ? 'Leer lassen, um nicht zu ändern' : 'OpenStack-Passwort'}
                        value={form.password}
                        onChange={set('password')}
                        required={!existingProject}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-teal-500 hover:bg-teal-600 text-white"
                    disabled={saveLoading || credentialsLoading}
                  >
                    {saveLoading ? 'Wird gespeichert...' : 'Zugangsdaten speichern'}
                  </Button>

                  {existingProject && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                          disabled={deleteLoading}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {deleteLoading ? 'Wird gelöscht...' : 'Projekt entfernen'}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Projekt entfernen?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Das OpenStack-Projekt <strong>{existingProject.openstack_project_name}</strong> wird aus dem System entfernt. Diese Aktion kann nicht rückgängig gemacht werden.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-row justify-end gap-2">
                          <AlertDialogCancel className="mt-0">Abbrechen</AlertDialogCancel>
                          <Button
                            type="button"
                            style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                            onClick={handleDeleteProject}
                            disabled={deleteLoading}
                          >
                            {deleteLoading ? 'Wird gelöscht...' : 'Entfernen'}
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </form>
              </CardContent>
            </Card>

            {/* Quotas */}
            <div className="space-y-6">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5" />
                    Ressourcen-Quotas
                  </CardTitle>
                  <CardDescription>Aktuelle Zuteilungslimits Ihres Projekts</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {quotasLoading && (
                    <p className="text-sm text-slate-500">Lädt...</p>
                  )}
                  {!quotasLoading && !quotas && (
                    <p className="text-sm text-slate-500">Keine Quota-Daten verfügbar</p>
                  )}
                  {!quotasLoading && quotas && (() => {
                    const qc = quotas.compute.cores;
                    const qram = quotas.compute.ram;
                    const qvol = quotas.volume.gigabytes;
                    const qinst = quotas.compute.instances;
                    const qfip = quotas.network.floatingip;
                    return (
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">CPU-Kerne</span>
                            <span className="text-slate-900">{qc.used} / {qc.limit}</span>
                          </div>
                          <Progress value={percent(qc.used, qc.limit)} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">Arbeitsspeicher</span>
                            <span className="text-slate-900">{formatMBasGB(qram.used)} / {formatMBasGB(qram.limit)}</span>
                          </div>
                          <Progress value={percent(qram.used, qram.limit)} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">Speicher (Volumes)</span>
                            <span className="text-slate-900">{formatGB(qvol.used)} / {formatGB(qvol.limit)}</span>
                          </div>
                          <Progress value={percent(qvol.used, qvol.limit)} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">VM-Instanzen</span>
                            <span className="text-slate-900">{qinst.used} / {qinst.limit}</span>
                          </div>
                          <Progress value={percent(qinst.used, qinst.limit)} className="h-2" />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-slate-600">Floating IPs</span>
                            <span className="text-slate-900">{qfip.used} / {qfip.limit}</span>
                          </div>
                          <Progress value={percent(qfip.used, qfip.limit)} className="h-2" />
                        </div>
                        <div className="pt-2 border-t border-slate-100">
                          <div className="flex justify-between items-center text-xs text-slate-400">
                            <span>Projekt: {quotas.project_name}</span>
                            <span>Stand: {new Date(quotas.fetched_at).toLocaleTimeString('de-DE')}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Admin-Spezifische Einstellungen */}
      {settingsMode === 'admin' && (
        <>
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
                    <Input id="max-cpu-threshold" type="number" className="mt-2" defaultValue="8" />
                  </div>
                  <div>
                    <Label htmlFor="max-ram-threshold" className="text-sm text-slate-600">
                      Max. RAM (GB)
                    </Label>
                    <Input id="max-ram-threshold" type="number" className="mt-2" defaultValue="16" />
                  </div>
                  <div>
                    <Label htmlFor="max-gpu-threshold" className="text-sm text-slate-600">
                      Max. GPU-Einheiten
                    </Label>
                    <Input id="max-gpu-threshold" type="number" className="mt-2" defaultValue="1" />
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
                <Switch checked={encryptSecrets} onCheckedChange={setEncryptSecrets} />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                <div className="flex-1">
                  <p className="text-slate-900">Prinzip der minimalen Berechtigung</p>
                  <p className="text-sm text-slate-500">
                    OpenStack-APIs nur mit minimalen erforderlichen Rechten nutzen
                  </p>
                </div>
                <Switch checked={enforceMinPrivilege} onCheckedChange={setEnforceMinPrivilege} />
              </div>

              <div>
                <Label htmlFor="encryption-key">Verschlüsselungs-Algorithmus</Label>
                <Input id="encryption-key" className="mt-2" defaultValue="AES-256-GCM" disabled />
              </div>

              <div>
                <Label htmlFor="key-rotation">Schlüsselrotation (Tage)</Label>
                <Input id="key-rotation" type="number" className="mt-2" defaultValue="90" />
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
                <Switch checked={autoImageCreation} onCheckedChange={setAutoImageCreation} />
              </div>

              <div>
                <Label htmlFor="automation-script">Automatisierungsskript-Pfad</Label>
                <Input
                  id="automation-script"
                  className="mt-2"
                  defaultValue="/opt/dozilab/scripts/create-base-image.sh"
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
                  <Input id="image-retention" type="number" className="mt-2" defaultValue="365" />
                </div>
                <div>
                  <Label htmlFor="max-concurrent-builds" className="text-sm text-slate-600">
                    Max. gleichzeitige Builds
                  </Label>
                  <Input id="max-concurrent-builds" type="number" className="mt-2" defaultValue="3" />
                </div>
              </div>

              <Button variant="outline" className="w-full">
                <FileCode className="w-4 h-4 mr-2" />
                Automatisierungsskript testen
              </Button>
            </CardContent>
          </Card>

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
