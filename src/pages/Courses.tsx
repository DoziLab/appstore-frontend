import { useEffect, useMemo, useState, ChangeEvent, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Server, Plus, X, Pencil, Check } from "lucide-react";
import { toast } from "sonner@2.0.3";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { getMyCourses, CourseDto } from "../api/courses";
import { getKeycloakGroups, KeycloakGroup } from "../api/keycloak";
import {
  listCourseFilters,
  createCourseFilter,
  updateCourseFilter,
  deleteCourseFilter,
  CourseFilter,
} from "../api/courseFilters";
import { ApiError } from "../api/http";
import { useCurrentUser } from "../auth/useCurrentUser";
import { useActiveOpenstackProject } from "../contexts/OpenstackProjectContext";

type CourseUi = {
  id: string;
  code: string;
  name: string;
  keycloakGroupName: string;
  applications: Array<{ id: string; name: string; status: string; created_at?: string }>;
};

// Map an ApiError from the course-filters endpoints to a user-facing message.
// The backend answers 409 on a duplicate name (message already reads
// "Course filter with name 'X' already exists") and 422 on empty/invalid or
// unknown-key payloads — see appstore-backend src/schemas/course_filter.py.
function filterErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 409) return e.message || "Filter existiert bereits.";
    if (e.status === 422) return "Ungültiger Filter-Name (1–255 Zeichen, nicht leer).";
    if (e.status === 403) return "Nur Admins dürfen Filter verwalten.";
    if (e.status === 404) return "Filter nicht gefunden (evtl. bereits gelöscht).";
    return e.message || fallback;
  }
  return e instanceof Error ? e.message : fallback;
}

export function Courses() {
  const navigate = useNavigate();
  const { isAdmin } = useCurrentUser();
  const { activeProjectId } = useActiveOpenstackProject();
  const [items, setItems] = useState<CourseDto[]>([]);
  const [keycloakGroups, setKeycloakGroups] = useState<KeycloakGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Admin-managed filter chips (fetched from the backend). The set of active
  // chip *names* drives client-side filtering with OR semantics.
  const [filters, setFilters] = useState<CourseFilter[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [filtersError, setFiltersError] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  // Admin management UI state.
  const [newFilterName, setNewFilterName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

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
        //
        // Backend caps page_size at 100 (src/core/dependencies.py); request the
        // max so the client-side filter operates over the full course set
        // rather than only the first page.
        const [coursesRes, groupsRes] = await Promise.all([
          getMyCourses({ page: 1, page_size: 100, openstack_project_id: activeProjectId }),
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

  // Load the admin-managed filter chips once on mount. GET is open to any
  // logged-in user, so both lecturers and admins see the same chips.
  const loadFilters = async () => {
    try {
      setFiltersLoading(true);
      setFiltersError(null);
      const list = await listCourseFilters();
      setFilters(list);
      // Drop any active selections that no longer exist after a refetch.
      setActiveFilters((prev) => {
        const names = new Set(list.map((f) => f.name));
        const next = new Set<string>();
        prev.forEach((n) => {
          if (names.has(n)) next.add(n);
        });
        return next;
      });
    } catch (e) {
      setFiltersError(e instanceof Error ? e.message : "Filter konnten nicht geladen werden");
    } finally {
      setFiltersLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setFiltersLoading(true);
        setFiltersError(null);
        const list = await listCourseFilters();
        if (!alive) return;
        setFilters(list);
      } catch (e) {
        if (!alive) return;
        setFiltersError(e instanceof Error ? e.message : "Filter konnten nicht geladen werden");
      } finally {
        if (alive) setFiltersLoading(false);
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
          id: d.id,
          name: d.name,
          status: d.status || "stopped",
          created_at: d.created_at,
        })),
      };
    });
  }, [items, keycloakGroups]);

  const filteredCourses = useMemo(() => {
    // Filter out courses without deployments
    const coursesWithDeployments = courses.filter((c) => c.applications.length > 0);

    if (activeFilters.size === 0) return coursesWithDeployments;

    // OR semantics across active chips: a course matches if ANY active chip
    // term is a case-INSENSITIVE substring of its keycloak group name or its
    // course name. (Was previously a case-SENSITIVE `startsWith` against a
    // hardcoded prefix list.)
    const terms = Array.from(activeFilters).map((t) => t.toLowerCase());
    return coursesWithDeployments.filter((c) => {
      const haystacks = [c.keycloakGroupName || "", c.name || ""].map((s) => s.toLowerCase());
      return terms.some((t) => haystacks.some((h) => h.includes(t)));
    });
  }, [courses, activeFilters]);

  const toggleFilter = (name: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleAddFilter = async () => {
    const name = newFilterName.trim();
    if (!name || adding) return;
    try {
      setAdding(true);
      await createCourseFilter(name);
      setNewFilterName("");
      toast.success(`Filter „${name}" hinzugefügt.`);
      await loadFilters();
    } catch (e) {
      toast.error(filterErrorMessage(e, "Filter konnte nicht angelegt werden."));
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteFilter = async (f: CourseFilter) => {
    try {
      await deleteCourseFilter(f.id);
      toast.success(`Filter „${f.name}" gelöscht.`);
      await loadFilters();
    } catch (e) {
      toast.error(filterErrorMessage(e, "Filter konnte nicht gelöscht werden."));
    }
  };

  const startEdit = (f: CourseFilter) => {
    setEditingId(f.id);
    setEditingName(f.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = async (f: CourseFilter) => {
    const name = editingName.trim();
    if (!name) {
      toast.error("Filter-Name darf nicht leer sein.");
      return;
    }
    if (name === f.name) {
      cancelEdit();
      return;
    }
    try {
      await updateCourseFilter(f.id, name);
      toast.success(`Filter in „${name}" umbenannt.`);
      cancelEdit();
      await loadFilters();
    } catch (e) {
      toast.error(filterErrorMessage(e, "Filter konnte nicht umbenannt werden."));
    }
  };

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
    <div className="p-4 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <h1 className="text-slate-900 mb-2">Kurse</h1>
          <p className="text-slate-600">Übersicht über Ihre Anwendungen nach Kursen geordnet</p>
        </div>
      </div>

      {/* Admin-managed filter chip-bar. Chips toggle a client-side substring
          filter (OR across active chips). Admins additionally get inline
          add / rename / delete controls; non-admins see read-only chips. */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">Kurs-Filter:</div>
          {activeFilters.size > 0 && (
            <Button variant="outline" onClick={() => setActiveFilters(new Set())}>
              Alle anzeigen
            </Button>
          )}
        </div>

        {filtersLoading && <div className="text-xs text-slate-500">Filter werden geladen…</div>}
        {filtersError && <div className="text-xs text-red-600">{filtersError}</div>}

        {!filtersLoading && !filtersError && filters.length === 0 && (
          <div className="text-xs text-slate-400">
            {isAdmin ? "Noch keine Filter angelegt." : "Es sind keine Kurs-Filter definiert."}
          </div>
        )}

        <div className="flex gap-2 flex-wrap items-center">
          {filters.map((f) => {
            const isActive = activeFilters.has(f.name);
            if (editingId === f.id) {
              return (
                <span
                  key={f.id}
                  className="inline-flex items-center gap-1 rounded-full border border-teal-500 px-2 py-1"
                >
                  <Input
                    type="text"
                    value={editingName}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEditingName(e.target.value)}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter") handleSaveEdit(f);
                      if (e.key === "Escape") cancelEdit();
                    }}
                    className="h-8 w-auto text-sm"
                    autoFocus
                  />
                  <button
                    type="button"
                    aria-label="Umbenennen speichern"
                    onClick={() => handleSaveEdit(f)}
                    className="p-1 rounded text-teal-600 hover:bg-teal-100"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Abbrechen"
                    onClick={cancelEdit}
                    className="p-1 rounded text-slate-500 hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </span>
              );
            }
            return (
              <span
                key={f.id}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${
                  isActive ? "bg-teal-500 text-white" : "bg-white border border-slate-200 text-slate-700"
                }`}
              >
                <button
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => toggleFilter(f.name)}
                  onDoubleClick={() => isAdmin && startEdit(f)}
                  className="cursor-pointer"
                >
                  {f.name}
                </button>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      aria-label={`Filter ${f.name} umbenennen`}
                      onClick={() => startEdit(f)}
                      className={`p-1 rounded ${isActive ? "hover:bg-teal-600" : "hover:bg-slate-100"}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Filter ${f.name} löschen`}
                      onClick={() => handleDeleteFilter(f)}
                      className={`p-1 rounded ${isActive ? "hover:bg-teal-600" : "text-red-600 hover:bg-red-100"}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                )}
              </span>
            );
          })}
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <Input
              type="text"
              placeholder="Neuer Filter (z.B. SQL)"
              className="w-64 max-w-md pl-3"
              value={newFilterName}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setNewFilterName(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter") handleAddFilter();
              }}
            />
            <Button
              variant="outline"
              onClick={handleAddFilter}
              disabled={adding || !newFilterName.trim()}
              aria-label="Filter hinzufügen"
            >
              <Plus className="w-4 h-4 mr-1" />
              Hinzufügen
            </Button>
          </div>
        )}
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

      {!loading && !error && filteredCourses.length === 0 && (
        <Card className="border-slate-200">
          <CardHeader className="pb-6">
            <CardTitle>Keine Deployments vorhanden</CardTitle>
            <CardDescription>Es wurden keine Kurse mit Deployments gefunden.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {!loading && !error && filteredCourses.length > 0 && (
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
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-slate-600">Bereitgestellte Anwendungen</span>
                    <span className="text-slate-900">{course.applications.length}</span>
                  </div>
                  {/*
                    The backend silently filters out deployments whose teacher.id
                    no longer resolves to a local user (see appstore-backend
                    src/api/courses.py:_filter_deployments_by_owner). Make that
                    behaviour visible so a lecturer who expects more apps knows
                    the count is scoped, not authoritative.
                  */}
                  <p className="text-xs text-slate-400 mb-3">
                    Es werden nur Deployments angezeigt, deren Owner Sie sind.
                  </p>

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
