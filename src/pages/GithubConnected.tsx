import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner@2.0.3";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { githubErrorMessage } from "../api/github";

/**
 * Landing-Route nach dem GitHub-App-Install. Das Backend leitet hier hin
 * weiter, wir lesen den Status aus der Query, zeigen einen Toast und
 * navigieren zurück auf die Seite, von der der Connect-Flow gestartet wurde
 * (vorher in `sessionStorage` unter `github.returnTo` abgelegt).
 *
 * Diese Route muss in `App.tsx` öffentlich erreichbar sein — der Nutzer kommt
 * gerade von github.com zurück und hat eventuell noch keine frische
 * Keycloak-Session in diesem Tab. Nach dem Toast navigieren wir in den
 * authentifizierten Bereich; Keycloak greift dort wieder.
 */
export function GithubConnected() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const status = params.get("status");
  const reason = params.get("reason");
  const ok = status === "ok";

  useEffect(() => {
    if (ok) {
      toast.success("GitHub erfolgreich verbunden.");
    } else {
      toast.error(githubErrorMessage(reason));
    }

    // Zurück zur Ursprungsseite; Fallback ist die Settings-Seite, wo der
    // Connect-Button lebt.
    const returnTo = sessionStorage.getItem("github.returnTo") ?? "/config";
    sessionStorage.removeItem("github.returnTo");

    // Kurzer Toast-Moment, dann redirect — replace, damit der Back-Button
    // nicht im Callback hängen bleibt.
    const t = setTimeout(() => navigate(returnTo, { replace: true }), 1500);
    return () => clearTimeout(t);
  }, [ok, reason, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="max-w-md text-center p-8">
        <div className="mb-4 flex justify-center">
          {ok ? (
            <CheckCircle2 className="w-16 h-16 text-green-500" />
          ) : status === "error" ? (
            <AlertCircle className="w-16 h-16 text-red-500" />
          ) : (
            <Loader2 className="w-16 h-16 text-teal-500 animate-spin" />
          )}
        </div>
        <h1 className="text-slate-900 text-xl mb-2">
          {ok ? "GitHub verbunden" : "GitHub-Verbindung"}
        </h1>
        <p className="text-slate-600 text-sm">
          {ok
            ? "Du wirst gleich zurückgeleitet…"
            : githubErrorMessage(reason)}
        </p>
      </div>
    </div>
  );
}
