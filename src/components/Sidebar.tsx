<<<<<<< HEAD
import { LayoutDashboard, BookOpen, Store, Settings, ChevronRight, LogOut, Shield, ScanEye } from 'lucide-react';
=======
import {
  LayoutDashboard,
  BookOpen,
  Store,
  Settings,
  ChevronRight,
  LogOut,
  Shield,
} from "lucide-react";
import { useMemo } from "react";
import { useKeycloak } from "@react-keycloak/web";
>>>>>>> e19bceb (display user name and logout via keacloak)

interface SidebarProps {
  currentView: string;
  onViewChange: (view: "dashboard" | "courses" | "appstore" | "config" | "admin") => void;
  logo: string;
  deploymentActive: boolean;
}

function initialsFromName(name?: string) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Sidebar({ currentView, onViewChange, logo, deploymentActive }: SidebarProps) {
  const { keycloak, initialized } = useKeycloak();

  const navItems = [
<<<<<<< HEAD
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'courses', label: 'Kurse', icon: BookOpen },
    { id: 'appstore', label: 'App Store', icon: Store },
    { id: 'config', label: 'Einstellungen', icon: Settings },
    { id: 'documents', label: 'Dokumentation', icon: ScanEye },
    { id: 'admin', label: 'Admin Monitoring', icon: Shield },
=======
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "courses", label: "Kurse", icon: BookOpen },
    { id: "appstore", label: "App Store", icon: Store },
    { id: "config", label: "Einstellungen", icon: Settings },
    { id: "admin", label: "Admin Monitoring", icon: Shield },
>>>>>>> e19bceb (display user name and logout via keacloak)
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
    if (roles.includes("dozent") || roles.includes("teacher")) return "Dozent";
    if (roles.includes("student")) return "Student";
    return "Benutzer";
  }, [token]);

  const initials = initialsFromName(displayName);

  const handleLogout = async () => {
    // Optional: nach Logout zurück zur Startseite
    const redirectUri = window.location.origin;
    await keycloak.logout({ redirectUri });
  };

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-slate-200">
        <img src={logo} alt="DoziLab" className="h-40 w-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => !deploymentActive && onViewChange(item.id as any)}
              disabled={deploymentActive}
              className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all
                ${isActive ? "bg-teal-50 text-teal-600" : "text-slate-600 hover:bg-slate-50"}
                ${deploymentActive ? "opacity-50 cursor-not-allowed" : ""}
              `}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
              {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
            </button>
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
