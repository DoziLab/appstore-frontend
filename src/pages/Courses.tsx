import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, Server } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { getMyCourses, CourseDto } from "../api/courses";
import { getKeycloakGroups, KeycloakGroup } from "../api/keycloak";

type CourseUi = {
  id: string;
  code: string;
  name: string;
  keycloakGroupName: string;
  applications: Array<{ name: string; status: string; created_at?: string }>;
};

export function Courses() {
  const [items, setItems] = useState<CourseDto[]>([]);
  const [keycloakGroups, setKeycloakGroups] = useState<KeycloakGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [coursesRes, groupsRes] = await Promise.all([
          getMyCourses({ page: 1, page_size: 10}),
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
  }, []);

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
          name: d.name,
          status: d.status || "stopped",
          created_at: d.created_at,
        })),
      };
    });
  }, [items, keycloakGroups]);
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
          <p className="text-slate-600">Verwalten Sie Anwendungen für Ihre Kurse</p>
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
          {courses.map((course) => (
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
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100 hover:border-teal-200 transition-colors"
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

                  <Button variant="ghost" className="w-full mt-4 text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                    Anwendungen verwalten
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
