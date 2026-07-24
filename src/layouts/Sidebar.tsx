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
  /**
   * "desktop" (default): rendert das äußere <aside> mit fester 256px-Breite
   * und Border — das ist die klassische Seitenleiste.
   * "mobile": rendert nur den Inhalt (Logo/Nav/User) ohne <aside>-Wrapper,
   * gedacht als Content für einen <SheetContent>-Drawer. Das Logo wird
   * dabei kleiner, damit es nicht die halbe Drawer-Höhe frisst.
   */
  variant?: "desktop" | "mobile";
  /**
   * Wenn im Mobile-Modus in einem Sheet: schließt den Drawer beim Nav-Klick.
   * Auf Desktop bleibt undefined und wird ignoriert.
   */
  onNavigate?: () => void;
}

function initialsFromName(name?: string) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Sidebar({ logo, variant = "desktop", onNavigate }: SidebarProps) {
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
              { id: "admin-projects", label: "Projektübersicht", icon: Shield, path: "/admin/projects" },
              { id: "admin-templates", label: "Template-Freigaben", icon: Shield, path: "/admin/templates" },
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

  const isMobile = variant === "mobile";

  // Der komplette Inhalt (Logo, Nav, User-Profile) ist zwischen Desktop und
  // Mobile identisch — er wird auf Desktop in ein <aside> gepackt, auf Mobile
  // direkt in einen <SheetContent>. Das Logo wird auf Mobile kleiner (h-24
  // statt h-40), sonst frisst es die halbe Drawer-Höhe.
  const content = (
    <>
      {/* Logo */}
      <NavLink
        to={homePath}
        className="p-6 border-b border-slate-200 block transition-opacity hover:opacity-80"
        aria-label="Zur Startseite"
        onClick={onNavigate}
      >
        <img
          src={logo}
          alt="DoziLab"
          className={isMobile ? "h-24 w-auto" : "h-40 w-auto"}
        />
      </NavLink>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isAdminItem = item.id.startsWith('admin-');
          // Aktiv-Match strikt: sonst würde /admin auch bei /admin/lecturers
          // matchen und beide Items grün hervorheben. NavLink's built-in
          // isActive nutzt bei `end` einen exakten Path-Match — wir brauchen
          // keinen eigenen `startsWith`-Fallback mehr.
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end
              onClick={onNavigate}
              className={({ isActive }) => `
                w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                ${isActive && isAdminItem ? "bg-red-50 text-red-600" : isActive ? "bg-teal-50 text-teal-600" : isAdminItem ? "text-red-600 hover:bg-red-50" : "text-slate-600 hover:bg-slate-50"}
                ${deploymentActive ? "opacity-50 pointer-events-none" : ""}
              `}
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="flex-1 min-w-0">{item.label}</span>
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
              onClick={() => { onNavigate?.(); navigate('/config'); }}
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
    </>
  );

  if (isMobile) {
    // Kein <aside>-Wrapper: der Sheet-Container gibt schon einen fixen,
    // scrollbaren Rahmen vor. Wir stellen nur sicher, dass der Inhalt in
    // voller Höhe stacked ist.
    return <div className="flex h-full flex-col bg-white">{content}</div>;
  }

  return (
    <aside className="relative w-64 bg-white border-r border-slate-200 flex flex-col">
      {content}
    </aside>
  );
}
