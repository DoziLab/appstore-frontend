import { Settings, RefreshCw, CheckCircle2, AlertCircle, Server, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [yamlInput, setYamlInput] = useState("");
  const [yamlLoading, setYamlLoading] = useState(false);
  

  // Credentials state
  const [existingProject, setExistingProject] = useState<OpenstackProjectResponse | null>(null);
  const [credentialsLoading, setCredentialsLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [formFeedback, setFormFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [yamlFeedback, setYamlFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [deleteFeedback, setDeleteFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
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

  const saveData = async (data: OpenstackCredentialsCreate) => {
    if (!data.password.trim() && existingProject) {
      setFormFeedback({ type: 'error', message: 'Bitte geben Sie das Passwort ein, um die Zugangsdaten zu aktualisieren.' });
      setYamlFeedback(null);
      setDeleteFeedback(null);
      return;
    }
    setFormFeedback(null);
    setYamlFeedback(null);
    setDeleteFeedback(null);
    setSaveLoading(true);
    try {
      if (existingProject) {
        await updateOpenstackProject(existingProject.id, data);
      } else {
        await createOpenstackProject(data);
      }
      setFormFeedback({ type: 'success', message: 'Zugangsdaten erfolgreich gespeichert.' });
      setYamlFeedback(null);
      setDeleteFeedback(null);
      setForm((prev) => ({ ...prev, password: '' }));
      // Refresh project list to get updated data
      const projects = await listOpenstackProjects();
      if (projects.length > 0) setExistingProject(projects[0]);
    } catch (err) {
      setFormFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Fehler beim Speichern der Zugangsdaten' });
      setYamlFeedback(null);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    void saveData(form);
  };

  function parseCloudsYaml(yaml: string): Partial<OpenstackCredentialsCreate> | string {
    try {
      const cloudMatch = yaml.match(/clouds:\s*\n([\s\S]*)/);
      if (!cloudMatch) return "Kein 'clouds:' Block gefunden.";

      const body = cloudMatch[1];

      const get = (key: string) => {
        const m = body.match(new RegExp(`${key}:\\s*[\"']?([^\"'\\n]+?)[\"']?\\s*$`, "m"));
        return m ? m[1].trim() : "";
      };

      const result: Partial<OpenstackCredentialsCreate> = {
        auth_url: get('auth_url'),
        username: get('username'),
        password: get('password'),
        openstack_project_id: get('project_id'),
        openstack_project_name: get('project_name'),
        user_domain_name: get('user_domain_name') || 'Default',
        region_name: get('region_name'),
      };

      if (!result.auth_url) return 'auth_url nicht gefunden.';
      if (!result.username) return 'username nicht gefunden.';

      return result;
    } catch {
      return 'Fehler beim Lesen der YAML-Datei.';
    }
  }

  function validateCloudsYaml(yaml: string): string | null {
    // Basic checks for unclosed quotes and obvious broken lines
    const lines = yaml.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // line ends with an opening quote (no closing quote on same line)
      if (/:\s*["']\s*$/.test(line)) {
        return `Unvollständige Zeichenkette in Zeile ${i + 1}: fehlendes schließendes Anführungszeichen.`;
      }
      const dbl = (line.match(/\"/g) || []).length;
      const sgl = (line.match(/\'/g) || []).length;
      if (dbl % 2 !== 0) return `Unbalancierte Doppel-Anführungszeichen in Zeile ${i + 1}.`;
      if (sgl % 2 !== 0) return `Unbalancierte einfache Anführungszeichen in Zeile ${i + 1}.`;
    }
    // Quick global check for overall unbalanced quotes
    const allDbl = (yaml.match(/\"/g) || []).length;
    const allSgl = (yaml.match(/\'/g) || []).length;
    if (allDbl % 2 !== 0) return 'Unbalancierte Doppel-Anführungszeichen im Dokument.';
    if (allSgl % 2 !== 0) return 'Unbalancierte einfache Anführungszeichen im Dokument.';
    return null;
  }

  const handleYamlSubmit = () => {
    setYamlFeedback(null);
    const syntaxErr = validateCloudsYaml(yamlInput);
    if (syntaxErr) {
      setYamlFeedback({ type: 'error', message: syntaxErr });
      setFormFeedback(null);
      setDeleteFeedback(null);
      return;
    }
    const result = parseCloudsYaml(yamlInput);
    if (typeof result === 'string') {
      setYamlFeedback({ type: 'error', message: result });
      setFormFeedback(null);
      setDeleteFeedback(null);
      return;
    }
    const merged: OpenstackCredentialsCreate = {
      auth_url: result.auth_url ?? form.auth_url,
      username: result.username ?? form.username,
      password: result.password ?? form.password,
      user_domain_name: result.user_domain_name ?? form.user_domain_name ?? 'Default',
      region_name: result.region_name ?? form.region_name,
      openstack_project_id: result.openstack_project_id ?? form.openstack_project_id,
      openstack_project_name: result.openstack_project_name ?? form.openstack_project_name,
    };
    void saveYamlData(merged);
  };

  const saveYamlData = async (data: OpenstackCredentialsCreate) => {
    if (!data.password.trim() && existingProject) {
      setYamlFeedback({ type: 'error', message: 'Bitte geben Sie das Passwort ein, um die Zugangsdaten zu aktualisieren.' });
      setFormFeedback(null);
      setDeleteFeedback(null);
      return;
    }
    setYamlFeedback(null);
    setFormFeedback(null);
    setDeleteFeedback(null);
    setYamlLoading(true);
    try {
      if (existingProject) {
        await updateOpenstackProject(existingProject.id, data);
      } else {
        await createOpenstackProject(data);
      }
      setYamlFeedback({ type: 'success', message: 'Zugangsdaten erfolgreich gespeichert.' });
      setFormFeedback(null);
      setDeleteFeedback(null);
      setForm((prev) => ({ ...prev, password: '' }));
      const projects = await listOpenstackProjects();
      if (projects.length > 0) setExistingProject(projects[0]);
    } catch (err) {
      setYamlFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Fehler beim Speichern der Zugangsdaten' });
    } finally {
      setYamlLoading(false);
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
      setDeleteFeedback({ type: 'success', message: 'Projekt erfolgreich entfernt.' });
      setFormFeedback(null);
      setYamlFeedback(null);
    } catch (err) {
      setDeleteFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Fehler beim Löschen des Projekts' });
      setFormFeedback(null);
      setYamlFeedback(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Refs for internal sections
  const connectionRef = useRef<HTMLElement | null>(null);
  const githubRef = useRef<HTMLElement | null>(null);
  const authRef = useRef<HTMLElement | null>(null);
  const quotasRef = useRef<HTMLElement | null>(null);
  const [hoveredSection, setHoveredSection] = useState<'connection' | 'github' | 'authentication' | 'quotas' | null>(null);
  const activeSection = hoveredSection; // only hover determines active section

  const scrollToRef = useCallback((ref: typeof connectionRef) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Hover-only behaviour: no scroll-based observer

  return (
    <div className="p-8 h-screen box-border flex flex-col">
      <div className="mb-6 flex-none">
        <h1 className="text-slate-900 mb-2">Einstellungen</h1>
        <p className="text-slate-600">Verwalten Sie Ihre OpenStack-Konfiguration und Systemeinstellungen</p>
      </div>

      <div className="flex gap-8 flex-1 overflow-hidden">
        {/* Left: internal nav (approx 20% width, visible from md up) */}
        <aside className="md:block flex-shrink-0 w-1/7 min-w-[100px] max-w-[280px]">
          <nav className="space-y-2">
            <button
              onClick={() => scrollToRef(connectionRef)}
              className={`w-full text-left px-3 py-2 rounded-md transition ${activeSection === 'connection' ? 'bg-teal-50 text-teal-600' : 'text-slate-600 hover:bg-slate-50'}`}
              title="Verbindungsstatus"
            >
              Verbindungsstatus
            </button>

            <button
              onClick={() => scrollToRef(githubRef)}
              className={`w-full text-left px-3 py-2 rounded-md transition ${activeSection === 'github' ? 'bg-teal-50 text-teal-600' : 'text-slate-600 hover:bg-slate-50'}`}
              title="GitHub-Integration"
            >
              GitHub-Integration
            </button>

            <button
              onClick={() => scrollToRef(authRef)}
              className={`w-full text-left px-3 py-2 rounded-md transition ${activeSection === 'authentication' ? 'bg-teal-50 text-teal-600' : 'text-slate-600 hover:bg-slate-50'}`}
              title="Authentifizierung"
            >
              Authentifizierung
            </button>

            <button
              onClick={() => scrollToRef(quotasRef)}
              className={`w-full text-left px-3 py-2 rounded-md transition ${activeSection === 'quotas' ? 'bg-teal-50 text-teal-600' : 'text-slate-600 hover:bg-slate-50'}`}
              title="Quotas"
            >
              Quotas
            </button>
          </nav>
        </aside>

        {/* Right: content */}
        <main className="flex-1 overflow-auto pr-4 space-y-6">
          {/* Connection Status Card */}
          <section
            ref={connectionRef}
            data-section="connection"
            className="min-h-[120px]"
            aria-labelledby="connection-heading"
            onMouseEnter={() => setHoveredSection('connection')}
            onMouseLeave={() => setHoveredSection(null)}
          >
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
          </section>

          {/* GitHub-Integration — eigenständige Section zwischen Verbindung
              und Authentifizierung, jetzt mit Scrollspy-Hook (#139). */}
          <section
            ref={githubRef}
            data-section="github"
            aria-labelledby="github-heading"
            onMouseEnter={() => setHoveredSection('github')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <GithubIntegrationCard />
          </section>

          <section
            ref={authRef}
            data-section="authentication"
            className="min-h-[320px]"
            onMouseEnter={() => setHoveredSection('authentication')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            {/* Authentication Settings */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" id="authentication-heading">
                  <Settings className="w-5 h-5" />
                  Authentifizierung
                </CardTitle>
                <CardDescription>
                  {existingProject ? 'OpenStack-Zugangsdaten aktualisieren' : 'OpenStack-Zugangsdaten hinterlegen'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveCredentials} className="space-y-4">
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
                      <Button
                        type="submit"
                        className="w-full bg-teal-500 hover:bg-teal-600 text-white mt-4"
                        disabled={saveLoading || credentialsLoading}
                      >
                        {saveLoading ? 'Wird gespeichert...' : 'Zugangsdaten speichern'}
                      </Button>
                      {formFeedback && (
                        <div className={`mt-2 p-3 rounded-lg ${formFeedback.type === 'error' ? 'bg-red-50 border border-red-200 text-sm text-red-700' : 'bg-green-50 border border-green-200 text-sm text-green-700'}`}>
                          {formFeedback.message}
                        </div>
                      )}
                  </div>

                  <div>
                    <Label>Eingabe über clouds.yaml (alternativ)</Label>
                    <Textarea
                      className="font-mono text-sm h-40 resize-none mt-2"
                      placeholder={`clouds:\n  openstack:\n    auth:\n      auth_url: https://...\n      username: "user"\n      password: "pass"\n      project_id: abc123\n      project_name: "mein-projekt"\n      user_domain_name: "Default"\n    region_name: "RegionOne"`}
                      value={yamlInput}
                      onChange={(e) => setYamlInput(e.target.value)}
                      spellCheck={false}
                      disabled={yamlLoading || credentialsLoading}
                    />
                    <Button
                      type="button"
                      className="w-full bg-teal-500 hover:bg-teal-600 text-white mt-4"
                      onClick={handleYamlSubmit}
                      disabled={!yamlInput.trim() || yamlLoading || credentialsLoading}
                    >
                      {yamlLoading ? 'Wird gespeichert...' : 'Einlesen & speichern'}
                    </Button>
                    {yamlFeedback && (
                      <div className={`mt-2 p-3 rounded-lg ${yamlFeedback.type === 'error' ? 'bg-red-50 border border-red-200 text-sm text-red-700' : 'bg-green-50 border border-green-200 text-sm text-green-700'}`}>
                        {yamlFeedback.message}
                      </div>
                    )}
                  </div>



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
                          {deleteFeedback && (
                            <div className={`w-full mt-3 p-3 rounded-lg ${deleteFeedback.type === 'error' ? 'bg-red-50 border border-red-200 text-sm text-red-700' : 'bg-green-50 border border-green-200 text-sm text-green-700'}`}>
                              {deleteFeedback.message}
                            </div>
                          )}
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </form>
              </CardContent>
            </Card>
          </section>

          <section
            ref={quotasRef}
            data-section="quotas"
            className="min-h-[240px]"
            onMouseEnter={() => setHoveredSection('quotas')}
            onMouseLeave={() => setHoveredSection(null)}
          >
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" id="quotas-heading">
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
                    const qc = quotas.compute?.cores ?? { used: 0, limit: 0 };
                    const qram = quotas.compute?.ram ?? { used: 0, limit: 0 };
                    const qvol = quotas.volume?.gigabytes ?? { used: 0, limit: 0 };
                    const qinst = quotas.compute?.instances ?? { used: 0, limit: 0 };
                    const qfip = quotas.network?.floatingip ?? { used: 0, limit: 0 };
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
            </section>

        </main>
      </div>
    </div>
  );
}
