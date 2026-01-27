import React from "react";
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
import logo from "figma:asset/5c87f57a05de8f8018669c9004318908d006dcd5.png";

export default function App() {
  const { keycloak, initialized } = useKeycloak();

  // Keycloak initialisiert noch
  if (!initialized) {
    return <div className="p-6">Loading…</div>;
  }

  // Wenn nicht eingeloggt: deine Login-Seite anzeigen, Button triggert keycloak.login()
  if (!keycloak.authenticated) {
    return (
      <Login
        onLogin={() => keycloak.login()}
        logo={logo}
      />
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar logo={logo} />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
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
