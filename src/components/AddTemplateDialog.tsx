import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, CheckCircle2, Github, FileText, Loader2, Plug } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  getGithubInstallationStatus,
  importTemplateFromGithub,
  startGithubInstall,
  type GithubInstallationStatus,
} from '../api/github';

interface AddTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful import — caller can reload the template list. */
  onImported?: () => void;
}

/**
 * Erlaubt Dozenten, ein Template aus einem GitHub-Repo zu importieren. Der
 * Backend-Endpoint `POST /api/v1/templates/import-from-github` legt das
 * Template plus seine erste Version an; die Version landet zunächst auf
 * `approval_status = pending`, bis ein Admin sie freigibt.
 *
 * Voraussetzung: der Dozent hat seinen GitHub-Account bereits über die
 * Einstellungen verbunden — sonst kann das Backend das Repo nicht lesen und
 * antwortet mit 404. Wir prüfen den Verbindungsstatus beim Öffnen und
 * blockieren den Submit-Button frühzeitig, statt den Nutzer in einen
 * Backend-Fehler laufen zu lassen.
 *
 * Der zweite Tab ("Copy & Paste") existiert vorerst nur als Platzhalter —
 * das Backend unterstützt aktuell ausschließlich GitHub-Import.
 */
export function AddTemplateDialog({ open, onOpenChange, onImported }: AddTemplateDialogProps) {
  const navigate = useNavigate();

  // GitHub-Tab
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconUrl, setIconUrl] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [appYamlPath, setAppYamlPath] = useState('');

  // Manual-Tab (UI-only, kein Backend-Support)
  const [heatTemplate, setHeatTemplate] = useState('');
  const [cloudInit, setCloudInit] = useState('');
  const [appYaml, setAppYaml] = useState('');

  const [activeTab, setActiveTab] = useState('github');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Connection-Status: wird beim Öffnen geladen, damit wir frühzeitig
  // signalisieren können, falls noch kein GitHub-Account verbunden ist.
  const [ghStatus, setGhStatus] = useState<GithubInstallationStatus | null>(null);
  const [ghStatusLoading, setGhStatusLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setGhStatusLoading(true);
    getGithubInstallationStatus()
      .then(setGhStatus)
      .catch(() => setGhStatus({ connected: false, installation_id: null, repos: [] }))
      .finally(() => setGhStatusLoading(false));
  }, [open]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setIconUrl('');
    setGithubUrl('');
    setAppYamlPath('');
    setHeatTemplate('');
    setCloudInit('');
    setAppYaml('');
    setErrorMessage(null);
    setActiveTab('github');
  };

  const handleConnectGithub = async () => {
    try {
      // Beim Rückweg landen wir wieder auf der aktuellen Seite (vermutlich
      // /appstore). Der GithubConnected-Page-Handler liest diesen Wert.
      sessionStorage.setItem('github.returnTo', window.location.pathname);
      const { install_url } = await startGithubInstall();
      window.location.href = install_url;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'GitHub-Verbindung konnte nicht gestartet werden.',
      );
    }
  };

  const validateForm = (): string | null => {
    if (!name.trim()) return 'Bitte einen Namen angeben.';
    if (!githubUrl.trim()) return 'Bitte eine GitHub-URL angeben.';
    // Sehr lockere URL-Prüfung — das Backend parst die Form selbst
    // (Branch/Tag/Pfad) und meldet alles spezifischere zurück.
    if (!/^https?:\/\/github\.com\//i.test(githubUrl.trim())) {
      return 'GitHub-URL muss mit https://github.com/ beginnen.';
    }
    return null;
  };

  const handleImport = async () => {
    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const created = await importTemplateFromGithub({
        name: name.trim(),
        description: description.trim() || null,
        icon_url: iconUrl.trim() || null,
        github_url: githubUrl.trim(),
        app_yaml_path: appYamlPath.trim() || null,
      });
      toast.success('Template aus GitHub importiert', {
        description: 'Die neue Version wartet auf Admin-Freigabe.',
      });
      onImported?.();
      resetForm();
      onOpenChange(false);
      // Direkt zum AppStore navigieren, damit der Dozent das neue Template
      // sieht (bzw. später dessen Detail-Seite, sobald wir eine haben).
      if (created?.id) {
        navigate('/appstore');
      }
    } catch (err) {
      // Die Backend-Fehlertexte sind aussagekräftig (z.B. „Folder contains 62
      // files which exceeds the limit of 50.") — wir zeigen sie unverändert.
      const msg = err instanceof Error ? err.message : 'Import fehlgeschlagen.';
      setErrorMessage(msg);
      toast.error('Import fehlgeschlagen', { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const connected = ghStatus?.connected === true;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Template hinzufügen</DialogTitle>
          <DialogDescription className="text-slate-600">
            Importiere ein Template direkt aus einem GitHub-Repository.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="github" className="gap-2">
              <Github className="w-4 h-4" />
              GitHub-Repository
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <FileText className="w-4 h-4" />
              Copy & Paste
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: GitHub-Import */}
          <TabsContent value="github" className="space-y-4 mt-4">
            {/* Connection-Status */}
            {ghStatusLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                GitHub-Verbindung wird geprüft…
              </div>
            )}

            {!ghStatusLoading && !connected && (
              <Alert className="border-amber-200 bg-amber-50">
                <Plug className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      Dein GitHub-Account ist noch nicht verbunden. Ohne Verbindung
                      kann das Backend keine privaten oder organisationsinternen
                      Repos lesen.
                    </span>
                    <Button
                      size="sm"
                      onClick={handleConnectGithub}
                      className="bg-slate-900 hover:bg-slate-800 text-white shrink-0"
                    >
                      <Github className="w-4 h-4 mr-2" />
                      GitHub verbinden
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {!ghStatusLoading && connected && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 text-sm">
                  GitHub verbunden
                  {ghStatus && ghStatus.repos.length > 0 && (
                    <> · {ghStatus.repos.length} Repo{ghStatus.repos.length === 1 ? '' : 's'} sichtbar</>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tpl-name" className="text-slate-700">
                  Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="tpl-name"
                  placeholder="z. B. Postgres für Kurs X"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={255}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tpl-icon" className="text-slate-700">
                  Icon (optional)
                </Label>
                <Input
                  id="tpl-icon"
                  placeholder="mdi:database"
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  maxLength={500}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tpl-description" className="text-slate-700">
                Beschreibung (optional)
              </Label>
              <Textarea
                id="tpl-description"
                placeholder="Kurze Beschreibung des Templates…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="github-url" className="text-slate-700">
                GitHub-URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="github-url"
                type="url"
                placeholder="https://github.com/owner/repo/tree/main/postgres"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="font-mono text-sm"
                maxLength={1000}
              />
              <p className="text-xs text-slate-500">
                Repo-Wurzel, <code>.../tree/&lt;branch&gt;/&lt;ordner&gt;</code> oder
                {' '}<code>.../blob/&lt;ref&gt;/&lt;pfad&gt;/app.yaml</code> sind alle erlaubt.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="app-yaml-path" className="text-slate-700">
                Pfad zur <code>app.yaml</code> (optional)
              </Label>
              <Input
                id="app-yaml-path"
                placeholder="app.yaml"
                value={appYamlPath}
                onChange={(e) => setAppYamlPath(e.target.value)}
                className="font-mono text-sm"
                maxLength={500}
              />
              <p className="text-xs text-slate-500">
                Standard ist <code>app.yaml</code> direkt im angegebenen Ordner.
                Maximal 50 Dateien pro Ordner, max. 1 MB pro Datei.
              </p>
            </div>
          </TabsContent>

          {/* Tab 2: Manual (Platzhalter — nicht im Backend-Support) */}
          <TabsContent value="manual" className="space-y-4 mt-4">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                Der manuelle Upload ist aktuell nicht angebunden. Bitte nutze
                den GitHub-Tab — auch private Repos funktionieren, sobald der
                Account verbunden ist.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 opacity-50 pointer-events-none">
              <Label className="text-slate-700">Heat-Template (YAML)</Label>
              <Textarea
                value={heatTemplate}
                onChange={(e) => setHeatTemplate(e.target.value)}
                className="font-mono text-sm min-h-[120px]"
                placeholder="heat_template_version: 2021-04-16…"
                disabled
              />
              <Label className="text-slate-700">cloud-init (optional)</Label>
              <Textarea
                value={cloudInit}
                onChange={(e) => setCloudInit(e.target.value)}
                className="font-mono text-sm min-h-[80px]"
                disabled
              />
              <Label className="text-slate-700">app.yaml (optional)</Label>
              <Textarea
                value={appYaml}
                onChange={(e) => setAppYaml(e.target.value)}
                className="font-mono text-sm min-h-[80px]"
                disabled
              />
            </div>
          </TabsContent>
        </Tabs>

        {errorMessage && (
          <Alert className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 text-sm">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            className="flex-1"
            disabled={submitting}
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleImport}
            disabled={submitting || activeTab !== 'github' || !connected || ghStatusLoading}
            className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importiere…
              </>
            ) : (
              <>
                <Github className="w-4 h-4 mr-2" />
                Aus GitHub importieren
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
