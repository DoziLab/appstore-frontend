import { LayoutDashboard, BookOpen, Store, Settings, ChevronRight, LogOut, Shield, ScanEye } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: 'dashboard' | 'courses' | 'appstore' | 'config' | 'admin') => void;
  logo: string;
  deploymentActive: boolean;
}

export function Sidebar({ currentView, onViewChange, logo, deploymentActive }: SidebarProps) {
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "courses", label: "Kurse", icon: BookOpen },
    { id: "appstore", label: "App Store", icon: Store },
    { id: "config", label: "Einstellungen", icon: Settings },
    { id: "admin", label: "Admin Monitoring", icon: Shield },
  ];

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
                ${isActive 
                  ? 'bg-teal-50 text-teal-600' 
                  : 'text-slate-600 hover:bg-slate-50'
                }
                ${deploymentActive ? 'opacity-50 cursor-not-allowed' : ''}
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
            JD
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-900 truncate">John Doe</p>
            <p className="text-xs text-slate-500 truncate">Dozent</p>
          </div>

          {/* Logout Icon */}
          <button className="text-slate-400 hover:text-slate-600">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </aside>
  );
}