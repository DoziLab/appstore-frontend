import {
  LayoutDashboard,
  BookOpen,
  Store,
  Settings,
  ChevronRight,
  LogOut,
  Shield
} from "lucide-react";
import { useMemo } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { NavLink, useLocation } from "react-router-dom";

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

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { id: 'courses', label: 'Kurse', icon: BookOpen, path: '/courses' },
    { id: 'appstore', label: 'App Store', icon: Store, path: '/appstore' },
    { id: 'config', label: 'Einstellungen', icon: Settings, path: '/config' },
    { id: 'admin', label: 'Admin Monitoring', icon: Shield, path: '/admin' },
  ];

  // tokenParsed ist typisiert als unknown | KeycloakTokenParsed, daher casten wir vorsichtig
  const token = (keycloak?.tokenParsed ?? {}) as Record<string, any>;

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
    const roles: string[] = token?.realm_access?.roles ?? [];
    if (roles.includes("admin")) return "Admin";
    if (roles.includes("lecturer") || roles.includes("teacher")) return "Dozent";
    if (roles.includes("student")) return "Student";
    return "Benutzer";
  }, [token]);

  const initials = initialsFromName(displayName);

  const handleLogout = async () => {
    // Optional: nach Logout zurück zur Startseite
    const redirectUri = window.location.origin;
    await keycloak.logout({ redirectUri });
  };

  // Check if we're in a deployment wizard to disable navigation
  const deploymentActive = location.pathname.startsWith('/deploy/');

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <NavLink
        to="/dashboard"
        className="p-6 border-b border-slate-200 block transition-opacity hover:opacity-80"
        aria-label="Zum Dashboard"
      >
        <img src={logo} alt="DoziLab" className="h-40 w-auto" />
      </NavLink>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');

          return (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive: navIsActive }) => `
                w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                ${navIsActive || isActive ? "bg-teal-50 text-teal-600" : "text-slate-600 hover:bg-slate-50"}
                ${deploymentActive ? "opacity-50 pointer-events-none" : ""}
              `}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
              {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
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
    </aside>
  );
}
