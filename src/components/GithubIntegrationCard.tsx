import { useEffect, useState } from 'react';
import { Github, CheckCircle2, AlertCircle, Loader2, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import {
  disconnectGithubInstallation,
  getGithubInstallationStatus,
  startGithubInstall,
  type GithubInstallationStatus,
} from '../api/github';

/**
 * Settings-Card für die GitHub-App-Integration. Zeigt den aktuellen
 * Verbindungsstatus, listet sichtbare Repos und erlaubt Verbinden/Erneuern/Trennen.
 *
 * „Verbindung erneuern" stößt denselben Install-Flow an wie die Erstverbindung
 * — GitHub zeigt dort die „Update permissions / Repository access"-Seite und
 * der Nutzer kann sein Repo-Set anpassen, ohne erst trennen zu müssen.
 *
 * Edge-Case: `connected = true` mit `repos: []` heißt, dass die DB-Zuordnung
 * existiert, das Backend aber die Repos nicht listen konnte (Token-Mint,
 * App-Konfig, Netz). Wir behandeln den User als verbunden und zeigen einen
 * Hinweis statt eines Fehlers — der Reconnect-Button hilft, das selbst zu
 * reparieren.
 */
export function GithubIntegrationCard() {
  const [status, setStatus] = useState<GithubInstallationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const s = await getGithubInstallationStatus();
      setStatus(s);
    } catch (err) {
      console.error('GitHub-Status konnte nicht geladen werden', err);
      setStatus({ connected: false, installation_id: null, repos: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    try {
      // Pfad merken, damit die /github/connected-Landing-Seite uns wieder
      // hierher zurückbringt — sonst landet der Nutzer pauschal auf /config.
      sessionStorage.setItem('github.returnTo', window.location.pathname);
      const { install_url } = await startGithubInstall();
      // Vollwertige Navigation — fetch() würde GitHub's HTML-Install-Page
      // zurückbekommen, nicht das, was wir wollen.
      window.location.href = install_url;
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'GitHub-Install konnte nicht gestartet werden.',
      );
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnectGithubInstallation();
      toast.success('GitHub-Verbindung getrennt.');
      await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Trennen fehlgeschlagen.',
      );
    } finally {
      setBusy(false);
    }
  };

  const connected = status?.connected === true;
  const repos = status?.repos ?? [];

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle id="github-heading" className="flex items-center gap-2">
          <Github className="w-5 h-5" />
          GitHub-Integration
        </CardTitle>
        <CardDescription>
          Verknüpfe deinen GitHub-Account, um Templates direkt aus einem Repo zu importieren.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status-Zeile */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                loading
                  ? 'bg-slate-100'
                  : connected
                  ? 'bg-green-100'
                  : 'bg-slate-200'
              }`}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
              ) : connected ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <Github className="w-5 h-5 text-slate-500" />
              )}
            </div>
            <div>
              <p className="text-slate-900">
                {loading ? 'Wird geprüft…' : connected ? 'Verbunden' : 'Nicht verbunden'}
              </p>
              {connected && status?.installation_id != null && (
                <p className="text-xs text-slate-500">
                  Installation #{status.installation_id}
                </p>
              )}
            </div>
          </div>

          {!loading && !connected && (
            <Button
              onClick={handleConnect}
              disabled={busy}
              className="bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Github className="w-4 h-4 mr-2" />
              GitHub verbinden
            </Button>
          )}

          {!loading && connected && (
            <div className="flex items-center gap-2">
              {/* Reconnect: gleicher Install-Flow wie Erstverbindung. GitHub
                  zeigt dort die „Update permissions / Repository access"-Seite
                  — das löst Drift zwischen DB-Eintrag und tatsächlich
                  freigegebenen Repos, ohne dass der Nutzer erst trennen muss. */}
              <Button
                variant="outline"
                onClick={handleConnect}
                disabled={busy}
                title="Repository-Zugriff bei GitHub aktualisieren"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Verbindung erneuern
              </Button>
              <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Trennen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>GitHub-Verbindung trennen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Das Backend kann danach keine Repos mehr für dich lesen. Du
                    kannst jederzeit wieder verbinden. Bestehende Templates
                    bleiben unverändert.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row justify-end gap-2">
                  <AlertDialogCancel className="mt-0">Abbrechen</AlertDialogCancel>
                  <Button
                    type="button"
                    style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                    onClick={handleDisconnect}
                    disabled={busy}
                  >
                    {busy ? 'Wird getrennt…' : 'Trennen'}
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            </div>
          )}
        </div>

        {/* Repo-Liste */}
        {connected && repos.length > 0 && (
          <div>
            <p className="text-sm text-slate-700 mb-2">
              Sichtbare Repositories
              <Badge variant="outline" className="ml-2">
                {repos.length}
              </Badge>
            </p>
            <ul className="space-y-1 max-h-48 overflow-y-auto pr-1">
              {repos.map((repo) => (
                <li
                  key={repo.full_name}
                  className="flex items-center justify-between p-2 rounded-md hover:bg-slate-50 text-sm"
                >
                  <a
                    href={`https://github.com/${repo.full_name}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-700 hover:text-teal-600 inline-flex items-center gap-1.5"
                  >
                    {repo.full_name}
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </a>
                  {repo.private && (
                    <Badge variant="outline" className="text-xs">
                      privat
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {connected && repos.length === 0 && !loading && (
          // Edge-Case aus dem Backend-Vertrag: connected, aber repos nicht abrufbar.
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="flex-1 flex items-start justify-between gap-3">
              <span>
                Repository-Liste aktuell nicht abrufbar. Die Verbindung selbst
                besteht — über „Verbindung erneuern" kannst du den Zugriff bei
                GitHub auffrischen.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleConnect}
                disabled={busy}
                className="shrink-0 bg-white"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Erneuern
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
