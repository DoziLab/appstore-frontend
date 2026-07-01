import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, CheckCircle2, Github, FileText, Loader2, Plug, Lock, Globe, Image, Upload, X } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  getGithubInstallationStatus,
  importTemplateFromGithub,
  startGithubInstall,
  VERSION_ERROR_CODES,
  type GithubInstallationStatus,
} from '../api/github';
import { ApiError } from '../api/http';
import { uploadTemplateIcon } from '../api/templates';

const ICON_MAX_SIZE = 1 * 1024 * 1024; // 1 MB
const ICON_MAX_DIMENSION = 512;

/**
 * Verkleinert ein Bild client-seitig auf maximal ICON_MAX_DIMENSION x ICON_MAX_DIMENSION.
 */
async function resizeIconImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > ICON_MAX_DIMENSION || height > ICON_MAX_DIMENSION) {
        if (width > height) {
          height = (height / width) * ICON_MAX_DIMENSION;
          width = ICON_MAX_DIMENSION;
        } else {
          width = (width / height) * ICON_MAX_DIMENSION;
          height = ICON_MAX_DIMENSION;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Bildkonvertierung fehlgeschlagen'));
            return;
          }
          const resizedFile = new File([blob], file.name, {
            type: 'image/webp',
            lastModified: Date.now(),
          });
          resolve(resizedFile);
        },
        'image/webp',
        0.85
      );
    };

    img.onerror = () => reject(new Error('Bild konnte nicht geladen werden'));
    img.src = URL.createObjectURL(file);
  });
}

interface AddTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful import — caller can reload the template list. */
  onImported?: () => void;
}

/**
 * Erlaubt Dozenten, ein Template aus einem GitHub-Repo zu importieren. Der
 * Backend-Endpoint `POST /api/v1/templates/import-from-github` legt das
 * Template plus seine erste Version an. Mit `visibility` steuert der Nutzer,
 * ob das Template als „private" (kein Approval-Flow, sofort nutzbar) oder
 * „public" (Marktplatz, Lecturer-Import → pending → Admin-Freigabe) anlegt.
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
  const [githubUrl, setGithubUrl] = useState('');
  const [appYamlPath, setAppYamlPath] = useState('');
  // Visibility: Private = direkt nutzbar, kein Approval. Public = Marktplatz,
  // braucht Admin-Freigabe (für Lecturer). Default ist bewusst Private —
  // entspricht auch dem Backend-Default und ist der weniger destruktive Pfad.
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  // Icon-Upload: File + Preview
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreviewUrl, setIconPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setGithubUrl('');
    setAppYamlPath('');
    setVisibility('private');
    setIconFile(null);
    if (iconPreviewUrl) {
      URL.revokeObjectURL(iconPreviewUrl);
      setIconPreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        github_url: githubUrl.trim(),
        app_yaml_path: appYamlPath.trim() || null,
        visibility,
      });
      
      // Icon hochladen, falls ausgewählt
      if (iconFile && created?.id) {
        try {
          // Bild optimieren falls zu groß
          let fileToUpload = iconFile;
          if (iconFile.size > ICON_MAX_SIZE) {
            try {
              fileToUpload = await resizeIconImage(iconFile);
            } catch (resizeErr) {
              console.error('Icon-Optimierung fehlgeschlagen:', resizeErr);
              // Versuchen trotzdem das Original hochzuladen
            }
          }
          await uploadTemplateIcon(created.id, fileToUpload);
        } catch (iconErr) {
          // Icon-Upload-Fehler ist nicht kritisch — Template ist bereits
          // erstellt, User kann Icon später nachreichen.
          console.error('Icon-Upload fehlgeschlagen:', iconErr);
          const errorMessage = iconErr instanceof Error ? iconErr.message : String(iconErr);
          const description = errorMessage.includes('413') || errorMessage.includes('Too Large')
            ? 'Datei zu groß für Server. Icon kann später im Template-Bereich hochgeladen werden.'
            : 'Icon kann später im Template-Bereich hochgeladen werden.';
          toast.warning('Template importiert, Icon-Upload fehlgeschlagen', { description });
        }
      }
      
      toast.success('Template aus GitHub importiert', {
        description:
          visibility === 'private'
            ? 'Privates Template — sofort für dich verwendbar.'
            : 'Template wartet auf Erst-Freigabe (privat bis Admin approved).',
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
      // Strukturierte Versions-Validierungs-Fehler bekommen einen klar
      // handlungsorientierten Text (mit Hinweis auf die app.yaml im Repo);
      // alles andere fällt auf den generischen Backend-Text zurück.
      const msg = humanizeImportError(err);
      setErrorMessage(msg);
      toast.error('Import fehlgeschlagen', { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Konvertiert Backend-Fehler in einen User-tauglichen Hinweis.
   * Reagiert speziell auf die strukturierten ``VERSION_*``-Codes aus dem
   * Versions-Validator; bei anderen Fehlern wird die Backend-Message
   * unverändert übernommen (sie sind ohnehin meist gut formuliert,
   * z.B. „Folder contains 62 files which exceeds the limit of 50").
   */
  function humanizeImportError(err: unknown): string {
    if (err instanceof ApiError) {
      switch (err.code) {
        case VERSION_ERROR_CODES.MISSING_IN_MANIFEST:
          return (
            "Deine `app.yaml` enthält kein `app.version`-Feld (oder es ist leer). "
            + "Bitte ergänze z. B. `app:\n  version: 1.0.0` im Repo und importiere erneut."
          );
        case VERSION_ERROR_CODES.NOT_SEMVER:
          return (
            "`app.version` in deiner app.yaml ist kein gültiges Semver. "
            + "Format: `MAJOR.MINOR.PATCH`, z. B. `1.0.0` oder `2.0.1-beta`."
          );
        case VERSION_ERROR_CODES.NOT_STRICTLY_GREATER:
        case VERSION_ERROR_CODES.ALREADY_EXISTS:
          // Hier eher unwahrscheinlich (Erst-Import auf neues Template hat
          // keine Vorgänger), aber wenn doch: klare Anweisung statt
          // Standard-Text.
          return err.message;
        default:
          return err.message;
      }
    }
    return err instanceof Error ? err.message : 'Import fehlgeschlagen.';
  }

  const connected = ghStatus?.connected === true;

  // Hinweis-Heuristik: Eine `tree/<ref>/<ordner>`-URL ist im Backend kein
  // gültiger app.yaml-Pfad (der Backend-Parser füllt `path_from_url` mit dem
  // Ordnernamen und prüft hart auf `.yaml`/`.yml`-Endung — schlägt fehl).
  // Wenn der Nutzer also eine tree-URL eingibt und das Pfad-Feld leer lässt,
  // warnen wir inline, statt ihn in den Backend-Roundtrip laufen zu lassen.
  // Eine `blob/.../app.yaml`-URL ist davon nicht betroffen.
  const treeUrlNeedsPath = (() => {
    const url = githubUrl.trim();
    if (!url || appYamlPath.trim()) return false;
    return /^https?:\/\/github\.com\/[^/]+\/[^/]+\/tree\/[^/]+\/.+/i.test(url);
  })();

  // Live-Grund, warum der Import-Button (noch) nicht klickbar ist. Reihenfolge
  // entspricht der natürlichen Bearbeitungsreihenfolge: erst Tab/Verbindung,
  // dann Pflichtfelder, dann URL-Format. `null` = ready to import.
  const disabledReason: string | null = (() => {
    if (ghStatusLoading) return 'GitHub-Verbindungsstatus wird geprüft…';
    if (activeTab !== 'github') {
      return 'Manueller Upload ist nicht angebunden — bitte den GitHub-Tab nutzen.';
    }
    if (!connected) {
      return 'GitHub-Account verbinden, um zu importieren.';
    }
    if (!name.trim()) return 'Bitte einen Namen angeben.';
    if (!githubUrl.trim()) return 'Bitte eine GitHub-URL angeben.';
    if (!/^https?:\/\/github\.com\//i.test(githubUrl.trim())) {
      return 'GitHub-URL muss mit https://github.com/ beginnen.';
    }
    return null;
  })();

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
                  {/* w-full auf den inneren Wrapper: AlertDescription ist ein
                      CSS-Grid-Item mit justify-items:start, das Kinder sonst
                      auf ihre intrinsische Breite schrumpft — dann hat das
                      flex justify-between nichts zum Auseinanderschieben und
                      der „GitHub verbinden"-Button rutscht aus dem
                      DialogContent (siehe #149). */}
                  <div className="flex items-center justify-between gap-3 w-full">
                    <span>
                      Dein GitHub-Account ist noch nicht verbunden. Ohne Verbindung
                      kann das Backend keine privaten oder organisationsinternen
                      Repos lesen.
                    </span>
                    <Button
                      size="sm"
                      onClick={handleConnectGithub}
                      className="shrink-0"
                      // bg-slate-900 wird in der vor-gebackenen index.css
                      // nicht generiert, sodass text-white auf transparentem
                      // Hintergrund stehen würde — der Button wäre unsichtbar
                      // (#149).
                      style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
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

            {/* Icon-Upload */}
            <div className="space-y-2">
              <Label className="text-slate-700">Icon (optional)</Label>
              <div className="flex items-start gap-3">
                <div className="relative w-12 h-12 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden shrink-0">
                  {iconPreviewUrl ? (
                    <>
                      <img
                        src={iconPreviewUrl}
                        alt="Icon Preview"
                        style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }}
                        className="object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIconFile(null);
                          if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl);
                          setIconPreviewUrl(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition"
                        title="Icon entfernen"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <Image className="w-5 h-5 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      
                      // Client-seitige Validierung
                      const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
                      
                      if (file.size === 0) {
                        toast.error('Datei ist leer');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                        return;
                      }
                      if (!ALLOWED_TYPES.includes(file.type)) {
                        toast.error('Nur PNG, JPEG oder WebP erlaubt');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                        return;
                      }
                      // Größen-Check entfernt - wir optimieren automatisch beim Upload
                      
                      // Preview erstellen
                      if (iconPreviewUrl) URL.revokeObjectURL(iconPreviewUrl);
                      const previewUrl = URL.createObjectURL(file);
                      setIconFile(file);
                      setIconPreviewUrl(previewUrl);
                    }}
                    className="hidden"
                    disabled={submitting}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting}
                    className="text-xs w-full sm:w-auto"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {iconFile ? 'Anderes Bild wählen' : 'Bild hochladen'}
                  </Button>
                  <p className="text-xs text-slate-500">
                    PNG, JPEG oder WebP · Große Bilder werden automatisch optimiert
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="github-url" className="text-slate-700">
                GitHub-URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="github-url"
                type="url"
                placeholder="https://github.com/owner/repo/blob/main/postgres/app.yaml"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                className="font-mono text-sm"
                maxLength={1000}
              />
              <div className="text-xs text-slate-500 space-y-1">
                <p>Erlaubte URL-Formen:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  <li>
                    <code>https://github.com/&lt;owner&gt;/&lt;repo&gt;</code> — dann{' '}
                    <strong>Pfad zur <code>app.yaml</code> angeben</strong>
                    {' '}(z. B. <code>unterordner/app.yaml</code>).
                  </li>
                  <li>
                    <code>.../tree/&lt;branch&gt;/&lt;ordner&gt;</code> — dann ebenfalls{' '}
                    <strong>Pfad zur <code>app.yaml</code> angeben</strong>
                    {' '}(z. B. <code>&lt;ordner&gt;/app.yaml</code>).
                  </li>
                  <li>
                    <code>.../blob/&lt;ref&gt;/&lt;pfad&gt;/app.yaml</code> — Pfad-Feld kann leer bleiben.
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="app-yaml-path" className="text-slate-700">
                Pfad zur <code>app.yaml</code> {treeUrlNeedsPath ? <span className="text-red-500">*</span> : '(optional)'}
              </Label>
              <Input
                id="app-yaml-path"
                placeholder="unterordner/app.yaml"
                value={appYamlPath}
                onChange={(e) => setAppYamlPath(e.target.value)}
                className="font-mono text-sm"
                maxLength={500}
              />
              <p className="text-xs text-slate-500">
                Relativ zur Repo-Wurzel; muss auf <code>.yaml</code> oder <code>.yml</code> enden.
                Maximal 50 Dateien pro Ordner, max. 1 MB pro Datei.
              </p>
              {treeUrlNeedsPath && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 text-xs">
                    Die URL zeigt auf einen Ordner (<code>tree/…</code>). Bitte den{' '}
                    Pfad zur <code>app.yaml</code> ergänzen — sonst lehnt der Import ab.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Sichtbarkeit: bestimmt, ob das Template gleich im Marktplatz
                landet (Public → Admin-Freigabe nötig) oder erst privat bleibt
                (Private → kein Approval-Flow, direkt nutzbar). Default Private
                entspricht dem Backend-Default und ist konservativ. */}
            <div className="space-y-2">
              <Label className="text-slate-700">Sichtbarkeit</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVisibility('private')}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition ${
                    visibility === 'private'
                      ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                  aria-pressed={visibility === 'private'}
                >
                  <Lock className="w-4 h-4 mt-0.5 text-slate-600 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-sm text-slate-900">Privat (nur ich)</p>
                    <p className="text-xs text-slate-500">
                      Sofort verwendbar, keine Admin-Freigabe nötig.
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setVisibility('public')}
                  className={`flex items-start gap-3 p-3 rounded-lg border text-left transition ${
                    visibility === 'public'
                      ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                  aria-pressed={visibility === 'public'}
                >
                  <Globe className="w-4 h-4 mt-0.5 text-slate-600 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-sm text-slate-900">Öffentlich (Marktplatz)</p>
                    <p className="text-xs text-slate-500">
                      Bleibt zunächst privat. Sobald ein Admin die erste
                      Version freigibt, wird das Template im App Store
                      sichtbar.
                    </p>
                  </div>
                </button>
              </div>
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

        <div className="flex flex-col gap-2 pt-4 border-t">
          {/* Lokaler Hinweis direkt am Button: wenn disabled, sagen wir warum.
              Die globalen Banner (GitHub nicht verbunden, Manual-Tab) bleiben
              — der Helper hier ist die zusätzliche Erklärung am Aktionsort. */}
          {disabledReason && !submitting && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {disabledReason}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
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
            disabled={submitting || disabledReason !== null}
            title={disabledReason ?? undefined}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
