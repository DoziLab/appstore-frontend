import { useEffect, useMemo, useState, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ChevronRight, Server } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { getMyCourses, CourseDto } from "../api/courses";
import { getKeycloakGroups, KeycloakGroup } from "../api/keycloak";
import { useActiveOpenstackProject } from "../contexts/OpenstackProjectContext";

type CourseUi = {
  id: string;
  code: string;
  name: string;
  keycloakGroupName: string;
  applications: Array<{ id: string; name: string; status: string; created_at?: string }>;
};

export function Courses() {
  const navigate = useNavigate();
  const { activeProjectId } = useActiveOpenstackProject();
  const [items, setItems] = useState<CourseDto[]>([]);
  const [keycloakGroups, setKeycloakGroups] = useState<KeycloakGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prefixQuery, setPrefixQuery] = useState<string>("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Pass the active OpenStack project to the courses API so the
        // backend can scope each course's embedded `deployments` collection
        // to (project = activeProjectId) AND (teacher.id = caller). Without
        // this param the backend rejects non-admins with 400 — matches the
        // contract introduced in PR #137 for /api/v1/deployments.
        const [coursesRes, groupsRes] = await Promise.all([
          getMyCourses({ page: 1, page_size: 10, openstack_project_id: activeProjectId }),
          getKeycloakGroups(),
        ]);

        if (!alive) return;

        setItems(coursesRes.data || []);
        setKeycloakGroups(groupsRes.data || []);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [activeProjectId]);

  const courses: CourseUi[] = useMemo(() => {
    return items.map((c) => {
      // Find the Keycloak group name by ID
      const keycloakGroup = keycloakGroups.find((g) => g.id === c.keycloak_course_id);
      
      return {
        id: c.id,
        code: c.keycloak_course_id,
        name: c.name,
        keycloakGroupName: keycloakGroup?.name || c.keycloak_course_id,
        applications: (Array.isArray(c.deployments) ? c.deployments : []).map((d) => ({
          id: d.id,
          name: d.name,
          status: d.status || "stopped",
          created_at: d.created_at,
        })),
      };
    });
  }, [items, keycloakGroups]);

  // Derive available prefix suggestions — restrict to canonical prefixes
  const prefixSuggestions = useMemo(() => {
    // Only show these canonical prefixes (order matters)
    return ["WWI", "WI", "INF", "WIN"];
  }, [items, keycloakGroups]);

  const filteredCourses = useMemo(() => {
    if (!prefixQuery) return courses;
    const q = prefixQuery.toUpperCase();
    return courses.filter((c) => (c.keycloakGroupName || c.name || "").toUpperCase().startsWith(q));
  }, [courses, prefixQuery]);
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "running":
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Läuft</Badge>;
      case "deploying":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Wird bereitgestellt</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Fehlgeschlagen</Badge>;
      case "stopped":
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Gestoppt</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-slate-900 mb-2">Kurse</h1>
          <p className="text-slate-600">Übersicht über Ihre Anwendungen nach Kursen geordnet</p>
        </div>
      </div>

      {/* Prefix filter input + suggestions */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Input
            type="text"
            placeholder="Präfix suchen (z.B. WWI, INF, WIN)"
            className="flex-1 min-w-0 pl-3"
            value={prefixQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPrefixQuery(e.target.value.toUpperCase())}
          />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setPrefixQuery("")}>Alle</Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">Schnellfilter:</div>
          <div className="flex gap-2 flex-wrap">
            {prefixSuggestions.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={prefixQuery === p}
                onClick={() => setPrefixQuery(p)}
                className={`text-xs px-2 py-1 rounded ${prefixQuery === p ? 'bg-teal-500 text-white' : 'bg-white border border-slate-200'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle>Lade Kurse…</CardTitle>
            <CardDescription>Bitte warten</CardDescription>
          </CardHeader>
        </Card>
      )}

      {error && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Fehler</CardTitle>
            <CardDescription className="text-red-600">{error}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCourses.map((course) => (
            <Card key={course.id} className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white">
                        <BookOpen className="w-5 h-5" />
                      </div>
                      <span className="text-slate-900">{course.keycloakGroupName}</span>
                    </CardTitle>
                  </div>
                  {/* Students unbekannt -> Badge optional oder Placeholder */}
                  {/* <Badge variant="outline" className="border-slate-300">
                    <Users className="w-3 h-3 mr-1" />
                    UNKNOWN
                  </Badge> */}
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm mb-3">
                    <span className="text-slate-600">Bereitgestellte Anwendungen</span>
                    <span className="text-slate-900">{course.applications.length}</span>
                  </div>

                  <div className="space-y-2">
                    {course.applications.map((app, idx) => (
                      <div
                        key={idx}
                        onClick={() => navigate(`/deployment/${app.id}`)}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-teal-200 hover:bg-slate-100 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <Server className="w-4 h-4 text-slate-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-900 truncate">{app.name}</p>
                            {app.created_at && (
                              <p className="text-xs text-slate-500">Erstellt {new Date(app.created_at).toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                        {getStatusBadge(app.status)}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
