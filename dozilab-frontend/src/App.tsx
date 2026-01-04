import { useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { Courses } from "./components/Courses";
import { AppStore } from "./components/AppStore";
import { DeploymentWizard } from "./components/DeploymentWizard";
import { OpenStackConfig } from "./components/OpenStackConfig";
import { AdminMonitoring } from "./components/AdminMonitoring";
import { DeploymentDetails } from "./components/DeploymentDetails";
import { Sidebar } from "./components/Sidebar";
import { Login } from "./components/Login";
import { mockDeployments } from "./components/mockDeployments";
import logo from "figma:asset/5c87f57a05de8f8018669c9004318908d006dcd5.png";

type View =
  | "dashboard"
  | "courses"
  | "appstore"
  | "deployment"
  | "config"
  | "admin"
  | "deployment-details";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] =
    useState<View>("dashboard");
  const [deploymentActive, setDeploymentActive] =
    useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleStartDeployment = () => {
    setDeploymentActive(true);
    setCurrentView("deployment");
  };

  const handleCancelDeployment = () => {
    setDeploymentActive(false);
    setCurrentView("appstore");
  };

  const handleCompleteDeployment = () => {
    setDeploymentActive(false);
    setCurrentView("dashboard");
  };

  const handleSelectDeployment = (deploymentName: string) => {
    setSelectedDeployment(deploymentName);
    setCurrentView("deployment-details");
  };

  const handleBackToDashboard = () => {
    setSelectedDeployment(null);
    setCurrentView("dashboard");
  };

  const renderView = () => {
    if (deploymentActive) {
      return (
        <DeploymentWizard
          onCancel={handleCancelDeployment}
          onComplete={handleCompleteDeployment}
        />
      );
    }

    if (currentView === "deployment-details" && selectedDeployment) {
      const deployment = mockDeployments[selectedDeployment as keyof typeof mockDeployments];
      if (deployment) {
        return (
          <DeploymentDetails
            deployment={deployment}
            onBack={handleBackToDashboard}
          />
        );
      }
    }

    switch (currentView) {
      case "dashboard":
        return <Dashboard onSelectDeployment={handleSelectDeployment} />;
      case "courses":
        return <Courses />;
      case "appstore":
        return <AppStore onDeploy={handleStartDeployment} />;
      case "config":
        return <OpenStackConfig />;
      case "admin":
        return <AdminMonitoring />;
      default:
        return <Dashboard onSelectDeployment={handleSelectDeployment} />;
    }
  };

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} logo={logo} />;
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        logo={logo}
        deploymentActive={deploymentActive}
      />
      <main className="flex-1 overflow-auto">
        {renderView()}
      </main>
    </div>
  );
}