import {
  LayoutDashboard,
  BookOpen,
  Store,
  Settings,
  ChevronRight,
  LogOut,
  Shield,
  Server,
} from "lucide-react";
import { useMemo } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

interface SidebarProps {
  logo: string;
}

function initialsFromName(name?: string) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Sidebar({ logo }: SidebarProps) {
  const { keycloak, initialized } = useKeycloak();
  const location = useLocation();

  // tokenParsed ist typisiert als unknown | KeycloakTokenParsed, daher casten wir vorsichtig
  const token = (keycloak?.tokenParsed ?? {}) as Record<string, any>;
  const roles: string[] = token?.realm_access?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isLecturer = roles.includes("lecturer") || roles.includes("teacher");
  const isStudent = roles.includes("student") && !isLecturer && !isAdmin;

  // Studenten haben einen reduzierten Navigations-Stack — alles Lecturer-
  // spezifische würde im Backend 403 produzieren und sollte deshalb gar
  // nicht erst klickbar sein.
  //
  // Admin-only-Einträge tragen alle das Shield-Icon (visuelle Klammer für
  // „nur Admins sehen das"). Sie werden nur angehängt, wenn `isAdmin` ist.
  const navItems = isStudent
    ? [
        {
          id: "student-dashboard",
          label: "Meine Deployments",
          icon: Server,
          path: "/student/dashboard",
        },
      ]
    : [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
        { id: "courses", label: "Kurse", icon: BookOpen, path: "/courses" },
        { id: "appstore", label: "App Store", icon: Store, path: "/appstore" },
        ...(isAdmin
          ? [
              { id: "admin", label: "Admin Monitoring", icon: Shield, path: "/admin" },
              {
                id: "admin-lecturers",
                label: "Lecturer-Verwaltung",
                icon: Shield,
                path: "/admin/lecturers",
              },
            ]
          : []),
      ];

  const displayName = useMemo(() => {
    // Typische Claims: name, preferred_username, email
    return (
      token.name ||
      token.preferred_username ||
      token.email ||
      "Unbekannter Nutzer"
    );
  }, [token.name, token.preferred_username, token.email]);

  const roleLabel = useMemo(() => {
    if (isAdmin) return "Admin";
    if (isLecturer) return "Dozent";
    if (isStudent) return "Student";
    return "Benutzer";
  }, [isAdmin, isLecturer, isStudent]);

  const initials = initialsFromName(displayName);

  const handleLogout = async () => {
    // Optional: nach Logout zurück zur Startseite
    const redirectUri = window.location.origin;
    await keycloak.logout({ redirectUri });
  };

  const navigate = useNavigate();

  // Check if we're in a deployment wizard to disable navigation
  const deploymentActive = location.pathname.startsWith('/deploy/');

  // Studenten haben keinen Lecturer-Wizard und auch keine /dashboard-Route —
  // das Logo soll sie zu ihrer eigenen Übersicht führen.
  const homePath = isStudent ? "/student/dashboard" : "/dashboard";

  return (
    <aside className="relative w-64 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <NavLink
        to={homePath}
        className="p-6 border-b border-slate-200 block transition-opacity hover:opacity-80"
        aria-label="Zur Startseite"
      >
        <img src={logo} alt="DoziLab" className="h-40 w-auto" />
      </NavLink>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          // Aktiv-Match strikt: sonst würde /admin auch bei /admin/lecturers
          // matchen und beide Items grün hervorheben. NavLink's built-in
          // isActive nutzt bei `end` einen exakten Path-Match — wir brauchen
          // keinen eigenen `startsWith`-Fallback mehr.
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end
              className={({ isActive }) => `
                w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                ${isActive ? "bg-teal-50 text-teal-600" : "text-slate-600 hover:bg-slate-50"}
                ${deploymentActive ? "opacity-50 pointer-events-none" : ""}
              `}
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-5 h-5 shrink-0" />
                  {/* `whitespace-nowrap` verhindert den Umbruch am
                      Bindestrich („Lecturer-Verwaltung") — Hyphens sind
                      CSS-default-Break-Points. `truncate` (mit ellipsis)
                      wäre zu aggressiv, weil das Label auf w-64 knapp aber
                      vollständig passt. */}
                  <span className="flex-1 whitespace-nowrap">{item.label}</span>
                  {/* Chevron-Platz IMMER reservieren (nur Sichtbarkeit
                      togglen). Sonst würde das aktive Item den Chevron
                      nachträglich einblenden, den Label-Bereich um 16px
                      schmaler machen und „Lecturer-Verwaltung" bricht in
                      zwei Zeilen um. `shrink-0` verhindert dass der Chevron
                      selbst weichen muss. */}
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 ${isActive ? "" : "invisible"}`}
                    aria-hidden="true"
                  />
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-white">
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-900 truncate">{displayName}</p>
            <p className="text-xs text-slate-500 truncate">{roleLabel}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/config')}
              disabled={!initialized || !keycloak.authenticated}
              className="text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Einstellungen"
              aria-label="Einstellungen"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={!initialized || !keycloak.authenticated}
              className="text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
