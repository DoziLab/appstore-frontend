import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Server, FileText, FormInput } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { createOpenstackProject, updateOpenstackProject, type OpenstackCredentialsCreate } from "../api/openstackProjects";

function parseCloudsYaml(yaml: string): Partial<OpenstackCredentialsCreate> | string {
  try {
    // Extract the first cloud entry under clouds:
    const cloudMatch = yaml.match(/clouds:\s*\n([\s\S]*)/);
    if (!cloudMatch) return "Kein 'clouds:' Block gefunden.";

    const body = cloudMatch[1];

    const get = (key: string) => {
      const m = body.match(new RegExp(`${key}:\\s*["']?([^"'\\n]+?)["']?\\s*$`, "m"));
      return m ? m[1].trim() : "";
    };

    const result: Partial<OpenstackCredentialsCreate> = {
      auth_url: get("auth_url"),
      username: get("username"),
      password: get("password"),
      openstack_project_id: get("project_id"),
      openstack_project_name: get("project_name"),
      user_domain_name: get("user_domain_name") || "Default",
      region_name: get("region_name"),
    };

    if (!result.auth_url) return "auth_url nicht gefunden.";
    if (!result.username) return "username nicht gefunden.";

    return result;
  } catch {
    return "Fehler beim Lesen der YAML-Datei.";
  }
}

const emptyForm: OpenstackCredentialsCreate = {
  auth_url: "",
  username: "",
  password: "",
  user_domain_name: "Default",
  region_name: "",
  openstack_project_id: "",
  openstack_project_name: "",
};

export function OpenStackSetup({ onSuccess }: { onSuccess?: () => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"form" | "yaml">("yaml");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [yamlInput, setYamlInput] = useState("");
  const [form, setForm] = useState<OpenstackCredentialsCreate>(emptyForm);

  const set = (field: keyof OpenstackCredentialsCreate) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const save = async (data: OpenstackCredentialsCreate) => {
    setError(null);
    setLoading(true);
    try {
      await createOpenstackProject(data);
      onSuccess ? onSuccess() : navigate("/dashboard", { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      const body = (err as any)?.body ?? "";
      const existingId = (msg + body).match(/Use the existing project \(ID: ([^)]+)\)/)?.[1];
      if (existingId) {
        try {
          await updateOpenstackProject(existingId, data);
          onSuccess ? onSuccess() : navigate("/dashboard", { replace: true });
          return;
        } catch (updateErr) {
          setError(updateErr instanceof Error ? updateErr.message : "Fehler beim Aktualisieren der Zugangsdaten");
          return;
        }
      }
      setError(msg || "Fehler beim Speichern der Zugangsdaten");
    } finally {
      setLoading(false);
    }
  };

  const handleYamlSubmit = () => {
    setError(null);
    const result = parseCloudsYaml(yamlInput);
    if (typeof result === "string") {
      setError(result);
      return;
    }
    const merged = { ...emptyForm, ...result };
    setForm(merged);
    save(merged);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    save(form);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                <Server className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <CardTitle>OpenStack einrichten</CardTitle>
                <CardDescription>
                  Geben Sie Ihre Zugangsdaten ein oder fügen Sie eine clouds.yaml ein
                </CardDescription>
              </div>
            </div>

            {/* Tab toggle */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 mt-4">
              <button
                type="button"
                onClick={() => setTab("yaml")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm transition-all ${
                  tab === "yaml"
                    ? "bg-white text-teal-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-4 h-4" />
                clouds.yaml
              </button>
              <button
                type="button"
                onClick={() => setTab("form")}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm transition-all ${
                  tab === "form"
                    ? "bg-white text-teal-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FormInput className="w-4 h-4" />
                Formular
              </button>
            </div>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* YAML Tab */}
            {tab === "yaml" && (
              <div className="space-y-4">
                <Textarea
                  className="font-mono text-sm h-64 resize-none"
                  placeholder={`clouds:\n  openstack:\n    auth:\n      auth_url: https://...\n      username: "user"\n      password: "pass"\n      project_id: abc123\n      project_name: "mein-projekt"\n      user_domain_name: "Default"\n    region_name: "RegionOne"`}
                  value={yamlInput}
                  onChange={(e) => setYamlInput(e.target.value)}
                  spellCheck={false}
                  disabled={loading}
                />
                {loading && (
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full animate-[progress_1.5s_ease-in-out_infinite]" style={{ width: '60%', animation: 'pulse 1s ease-in-out infinite' }} />
                  </div>
                )}
                <Button
                  type="button"
                  className="w-full bg-teal-500 hover:bg-teal-600 text-white"
                  onClick={handleYamlSubmit}
                  disabled={!yamlInput.trim() || loading}
                >
                  {loading ? "Wird gespeichert..." : "Einlesen & speichern"}
                </Button>
              </div>
            )}

            {/* Form Tab */}
            {tab === "form" && (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="auth_url">Authentifizierungs-URL</Label>
                  <Input
                    id="auth_url"
                    className="mt-2"
                    placeholder="https://openstack.example.com:5000/v3"
                    value={form.auth_url}
                    onChange={set("auth_url")}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="openstack_project_id">Projekt-ID</Label>
                    <Input
                      id="openstack_project_id"
                      className="mt-2"
                      placeholder="abc123..."
                      value={form.openstack_project_id}
                      onChange={set("openstack_project_id")}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="openstack_project_name">Projektname</Label>
                    <Input
                      id="openstack_project_name"
                      className="mt-2"
                      placeholder="mein-projekt"
                      value={form.openstack_project_name}
                      onChange={set("openstack_project_name")}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="region_name">Region</Label>
                    <Input
                      id="region_name"
                      className="mt-2"
                      placeholder="RegionOne"
                      value={form.region_name}
                      onChange={set("region_name")}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="user_domain_name">User Domain</Label>
                    <Input
                      id="user_domain_name"
                      className="mt-2"
                      placeholder="Default"
                      value={form.user_domain_name}
                      onChange={set("user_domain_name")}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="username">Benutzername</Label>
                  <Input
                    id="username"
                    className="mt-2"
                    placeholder="OpenStack-Benutzername"
                    value={form.username}
                    onChange={set("username")}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="password">Passwort</Label>
                  <div className="relative mt-2">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="OpenStack-Passwort"
                      value={form.password}
                      onChange={set("password")}
                      required
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
                  disabled={loading}
                >
                  {loading ? "Wird gespeichert..." : "Zugangsdaten speichern & fortfahren"}
                </Button>
                {loading && (
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{ width: '60%', animation: 'pulse 1s ease-in-out infinite' }} />
                  </div>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
