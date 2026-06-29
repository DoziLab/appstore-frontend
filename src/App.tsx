import { useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Courses } from "./pages/Courses";
import { OpenStackConfig } from "./pages/OpenStackConfig";
import { AdminMonitoring } from "./pages/AdminMonitoring";
import { Sidebar } from "./layouts/Sidebar";
import { Login } from "./pages/Login";
import { DashboardPage } from "./pages/DashboardPage";
import { AppStorePage } from "./pages/AppStorePage";
import { DeploymentWizardPage } from "./pages/DeploymentWizardPage";
import { DeploymentDetailsPage } from "./pages/DeploymentDetailsPage";
import { StudentDashboardPage } from "./pages/StudentDashboardPage";
import { StudentDeploymentDetailsPage } from "./pages/StudentDeploymentDetailsPage";
import { OpenStackSetup } from "./pages/OpenStackSetup";
import { GithubConnected } from "./pages/GithubConnected";
import { Toaster } from "./components/ui/sonner";
import { listOpenstackProjects, type OpenstackProjectResponse } from "./api/openstackProjects";
import { OpenstackProjectProvider } from "./contexts/OpenstackProjectContext";
import logo from "figma:asset/5c87f57a05de8f8018669c9004318908d006dcd5.png";

export default function App() {
  const { keycloak, initialized } = useKeycloak();
  const [initTimedOut, setInitTimedOut] = useState(false);
  const [projectsChecked, setProjectsChecked] = useState(false);
  // We hold the full project (not just a boolean): the authenticated routes
  // need it via OpenstackProjectProvider so that any deployment-related
  // request can attach ?openstack_project_id=<local-DB-id>.
  const [activeProject, setActiveProject] = useState<OpenstackProjectResponse | null>(null);
  // Admins don't need a project to use the app, so we don't push them into the
  // OpenStack-setup route. We resolve this once after auth and keep it sticky.
  const [isLecturer, setIsLecturer] = useState(false);
  // Studenten haben einen eigenen /student/* Namespace; OpenStack-Setup wird
  // für sie komplett übersprungen. Wir merken uns das pro Session, damit die
  // Routing-Entscheidung stabil bleibt, auch wenn der Token zwischendurch
  // refreshed wird.
  const [isStudent, setIsStudent] = useState(false);

  // The GitHub-App install callback redirects the browser to
  // `/github/connected?status=…`. That route has to stay reachable even if
  // Keycloak isn't fully back yet — the user is mid-OAuth-round-trip and may
  // not have a fresh session in this tab. We short-circuit before any
  // auth/project gate kicks in.
  const location = useLocation();
  const isGithubCallback = location.pathname === "/github/connected";

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!initialized) {
        console.error("[Keycloak] Init timed out after 10s – initialized:", initialized);
        setInitTimedOut(true);
      }
    }, 10_000);
    return () => clearTimeout(timer);
  }, [initialized]);

  useEffect(() => {
    if (!keycloak.authenticated) return;
    const roles: string[] = (keycloak.tokenParsed as Record<string, any>)?.realm_access?.roles ?? [];
    const lecturer = roles.includes("lecturer") || roles.includes("teacher");
    const admin = roles.includes("admin");
    const student = roles.includes("student");
    setIsLecturer(lecturer);
    // Reiner Student (kein Lecturer/Admin) → eigene Routen, kein
    // OpenStack-Setup-Gate. Wenn ein User beides hat (z. B. testweise
    // Lecturer+Student), gewinnt Lecturer/Admin, weil die Lecturer-Flow
    // ausgereifter ist und der Student kann sich /student/* manuell aufrufen
    // (kommt in der Realität nicht vor, aber wir halten den Cut sauber).
    const pureStudent = student && !lecturer && !admin;
    setIsStudent(pureStudent);
    if (!lecturer) {
      // Admins und reine Studenten brauchen kein OpenStack-Projekt; in beiden
      // Fällen lassen wir activeProject auf null und springen das Setup-Gate.
      setActiveProject(null);
      setProjectsChecked(true);
      return;
    }
    listOpenstackProjects()
      .then((projects) => setActiveProject(projects[0] ?? null))
      .catch(() => setActiveProject(null))
      .finally(() => setProjectsChecked(true));
  }, [keycloak.authenticated]);

  // Lecturer must have an OpenStack project before using the rest of the app.
  // For admins this is always false (we never gate them on project setup).
  const needsSetup = isLecturer && activeProject === null;

  // Re-fetch the active project after the user finishes OpenStack setup.
  // (Setup writes credentials and returns a fresh project row.)
  const refreshActiveProject = () => {
    listOpenstackProjects()
      .then((projects) => setActiveProject(projects[0] ?? null))
      .catch(() => setActiveProject(null));
  };

  console.log("[Keycloak] initialized:", initialized, "authenticated:", keycloak?.authenticated);

  // Public route: GitHub install-callback landing. Must render regardless of
  // Keycloak state so the user can see the success/error toast and be sent
  // back into the app.
  if (isGithubCallback) {
    return (
      <>
        <GithubConnected />
        <Toaster richColors />
      </>
    );
  }

  // Keycloak still initializing
  if (!initialized && !initTimedOut) {
    return <div className="p-6">Initializing Keycloak…</div>;
  }

  if (!initialized && initTimedOut) {
    return (
      <div className="p-6 text-red-600">
        <p>Failed to initialize Keycloak.</p>
        <p className="text-sm text-gray-500 mt-2">
          Check if Keycloak is reachable at{" "}
          <a href={keycloak?.authServerUrl || "#"} target="_blank" rel="noreferrer" className="underline">
            {keycloak?.authServerUrl || "the configured URL"}
          </a>
          .
        </p>
        <button
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  // Not authenticated: show login page
  if (!keycloak.authenticated) {
    return (
      <Login
        onLogin={() => keycloak.login()}
        logo={logo}
      />
    );
  }

  // Waiting for project check
  if (!projectsChecked) {
    return <div className="p-6">Laden…</div>;
  }

  // Lecturer without projects → setup
  if (needsSetup) {
    return (
      <Routes>
        <Route path="/setup" element={<OpenStackSetup onSuccess={refreshActiveProject} />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  return (
    <OpenstackProjectProvider project={activeProject}>
      <div className="flex h-screen bg-slate-50">
        <Sidebar logo={logo} />
        <main className="flex-1 overflow-auto">
          {isStudent ? (
            // Studenten haben keinen Zugriff auf Lecturer-Endpoints (Backend
            // gibt 403). Wir registrieren bewusst NUR /student/*, /config
            // (Settings) und einen Catch-All-Redirect; alles andere
            // (Dashboard, Courses, AppStore, Deploy, Admin) landet damit
            // automatisch wieder auf /student/dashboard.
            <Routes>
              <Route path="/" element={<Navigate to="/student/dashboard" replace />} />
              <Route path="/student/dashboard" element={<StudentDashboardPage />} />
              <Route
                path="/student/deployment/:deploymentId"
                element={<StudentDeploymentDetailsPage />}
              />
              <Route path="/config" element={<OpenStackConfig />} />
              <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/setup" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/appstore" element={<AppStorePage />} />
              <Route path="/deploy/:templateId" element={<DeploymentWizardPage />} />
              <Route path="/deployment/:deploymentId" element={<DeploymentDetailsPage />} />
              <Route path="/config" element={<OpenStackConfig />} />
              <Route path="/admin" element={<AdminMonitoring />} />
              {/* Lecturer/Admin auf /student/* → zurück aufs Dashboard. */}
              <Route path="/student/*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          )}
        </main>
      </div>
      <Toaster richColors />
    </OpenstackProjectProvider>
  );
}
