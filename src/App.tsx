import { useEffect, useState } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Routes, Route, Navigate } from "react-router-dom";
import { Courses } from "./pages/Courses";
import { OpenStackConfig } from "./pages/OpenStackConfig";
import { AdminMonitoring } from "./pages/AdminMonitoring";
import { Sidebar } from "./layouts/Sidebar";
import { Login } from "./pages/Login";
import { DashboardPage } from "./pages/DashboardPage";
import { AppStorePage } from "./pages/AppStorePage";
import { DeploymentWizardPage } from "./pages/DeploymentWizardPage";
import { DeploymentDetailsPage } from "./pages/DeploymentDetailsPage";
import { OpenStackSetup } from "./pages/OpenStackSetup";
import { listOpenstackProjects } from "./api/openstackProjects";
import logo from "figma:asset/5c87f57a05de8f8018669c9004318908d006dcd5.png";

export default function App() {
  const { keycloak, initialized } = useKeycloak();
  const [initTimedOut, setInitTimedOut] = useState(false);
  const [projectsChecked, setProjectsChecked] = useState(false);
  const [hasProjects, setHasProjects] = useState(false);

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
    const isLecturer = roles.includes("lecturer") || roles.includes("teacher");
    if (!isLecturer) {
      setHasProjects(true);
      setProjectsChecked(true);
      return;
    }
    listOpenstackProjects()
      .then((projects) => setHasProjects(projects.length > 0))
      .catch(() => setHasProjects(false))
      .finally(() => setProjectsChecked(true));
  }, [keycloak.authenticated]);

  console.log("[Keycloak] initialized:", initialized, "authenticated:", keycloak?.authenticated);

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
  if (!hasProjects) {
    return (
      <Routes>
        <Route path="/setup" element={<OpenStackSetup onSuccess={() => { setHasProjects(true); }} />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar logo={logo} />
      <main className="flex-1 overflow-auto">
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
        </Routes>
      </main>
    </div>
  );
}
