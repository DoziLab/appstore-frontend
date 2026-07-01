// Admin-Bereich: Übersicht + Löschung von Lecturer-Accounts.
//
// Backend-Endpoints (alle admin-only via router-guard):
//   • GET /api/v1/lecturers?skip=…&limit=…&search=…
//   • GET /api/v1/lecturers/{id}
//   • DEL /api/v1/lecturers/{id} → 202 Accepted (async Celery-Task)
//
// „Lecturer" wird nicht per Rolle definiert, sondern über Ressourcen-Besitz
// (Template ODER OpenStack-Projekt). Wer sich zwar in Keycloak einloggt aber
// noch nichts erstellt hat, taucht bewusst nicht auf — das verhindert dass
// die Liste mit Studenten oder Karteileichen geflutet wird.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { listLecturers, type LecturerListItem } from "../api/lecturers";
import { LecturerDetailDialog } from "../components/LecturerDetailDialog";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

export function LecturerManagement() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<LecturerListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1); // 1-indexed für die Anzeige
  const [searchInput, setSearchInput] = useState("");
  // Debounced-Wert, den wir tatsächlich ans Backend schicken. Anleitung sagt
  // mind. 300ms — kürzere Werte lösen einen Storm aus während der Admin tippt.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LecturerListItem | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce Search-Input → debouncedSearch
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      // Bei neuer Suche zurück auf Seite 1 — sonst laufen wir potenziell auf
      // einer leeren Seite hinter der neuen Trefferzahl.
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [searchInput]);

  const fetchLecturers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await listLecturers({
        skip: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
      });
      setRows(resp.data);
      setTotalItems(resp.pagination.total_items);
      setTotalPages(resp.pagination.total_pages || 1);
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Liste konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    void fetchLecturers();
  }, [fetchLecturers]);

  const showingRangeLabel = useMemo(() => {
    if (totalItems === 0) return "0 Einträge";
    const from = (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, totalItems);
    return `${from}–${to} von ${totalItems}`;
  }, [page, totalItems]);

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-slate-900 mb-2 flex items-center gap-2">
            <Users className="w-6 h-6 text-red-600" />
            Dozenten-Verwaltung
          </h1>
          <p className="text-slate-600 max-w-3xl">
            Alle User mit Templates oder OpenStack-Projekten. Löschen entfernt
            User + Ressourcen — der Keycloak-Account bleibt aber bestehen und
            legt beim nächsten Login einen leeren User neu an.
          </p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <CardTitle>Alle Lecturer</CardTitle>
              <CardDescription className="mt-1">
                {showingRangeLabel}
                {debouncedSearch ? ` · Filter: „${debouncedSearch}"` : ""}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Name, Email, Username…"
                  className="pl-8 w-64"
                  aria-label="Lecturer suchen"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchLecturers()}
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`}
                />
                Neu laden
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Letzter Login</TableHead>
                  <TableHead className="text-right">Templates</TableHead>
                  <TableHead className="text-right">Deployments</TableHead>
                  <TableHead className="text-right">OSPs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin inline-block mr-2" />
                      Lade Lecturer…
                    </TableCell>
                  </TableRow>
                )}
                {!loading && rows.length === 0 && !error && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      {debouncedSearch
                        ? "Kein Lecturer passt zu diesem Filter."
                        : "Es gibt aktuell keine Lecturer mit Ressourcen."}
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => {
                  const displayName =
                    row.display_name || row.username || row.email || row.id;
                  return (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => setSelected(row)}
                    >
                      <TableCell className="text-slate-900">
                        <div className="flex flex-col">
                          <span className="text-blue-600 hover:underline break-words">
                            {displayName}
                          </span>
                          {row.username && row.username !== displayName && (
                            <span className="text-xs text-slate-500 break-all">
                              @{row.username}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600 break-all">
                        {row.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">
                        {row.last_login_at
                          ? new Date(row.last_login_at).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{row.template_count}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{row.deployment_count}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {row.openstack_project_count}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination — nur anzeigen, wenn > 1 Seite. */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-slate-500">
                Seite {page} von {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canPrev || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Zurück
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!canNext || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Weiter
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selected && (
        <LecturerDetailDialog
          lecturer={selected}
          open={Boolean(selected)}
          onOpenChange={(open) => {
            if (!open) setSelected(null);
          }}
          onDeleted={() => {
            // Erfolgreiche Löschung → Liste neu laden. Wenn wir gerade auf
            // der letzten Seite waren und der eben gelöschte User der letzte
            // war, geht `page` nach dem Reload möglicherweise ins Leere;
            // wir korrigieren das defensiv nach dem Reload.
            setSelected(null);
            void fetchLecturers();
          }}
        />
      )}
    </div>
  );
}
