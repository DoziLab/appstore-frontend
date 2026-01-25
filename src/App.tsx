import React, { useState, useEffect } from "react";
import { useKeycloak } from "@react-keycloak/web";
import { Server } from "lucide-react";
import { Documents } from "./components/Documents";
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
import { getDeployment, getDeploymentLogs } from "./api/deployments";
import logo from "figma:asset/5c87f57a05de8f8018669c9004318908d006dcd5.png";

type View =
  | "dashboard"
  | "courses"
  | "appstore"
  | "deployment"
  | "config"
  | "documents"
  | "admin"
  | "deployment-details";

export default function App() {
  const { keycloak, initialized } = useKeycloak();

  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [deploymentActive, setDeploymentActive] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null);
  const [deploymentData, setDeploymentData] = useState<any>(null);
  const [loadingDeployment, setLoadingDeployment] = useState(false);

  const handleStartDeployment = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setDeploymentActive(true);
    setCurrentView("deployment");
  };

  const handleCancelDeployment = () => {
    setDeploymentActive(false);
    setSelectedTemplateId(null);
    setCurrentView("appstore");
  };

  const handleCompleteDeployment = (deploymentId: string) => {
    setDeploymentActive(false);
    setSelectedTemplateId(null);
    setSelectedDeploymentId(deploymentId);
    setCurrentView("deployment-details");
  };

  const handleSelectDeployment = (deploymentName: string) => {
    setSelectedDeployment(deploymentName);
    setSelectedDeploymentId(null); // Clear ID when using name-based selection
    setCurrentView("deployment-details");
  };

  const handleBackToDashboard = () => {
    setSelectedDeployment(null);
    setSelectedDeploymentId(null);
    setDeploymentData(null);
    setCurrentView("dashboard");
  };

  // Load deployment when selectedDeploymentId changes
  useEffect(() => {
    if (selectedDeploymentId && currentView === "deployment-details") {
      setLoadingDeployment(true);
      
      // Load deployment and logs in parallel
      Promise.all([
        getDeployment(selectedDeploymentId),
        getDeploymentLogs(selectedDeploymentId).catch(() => ({ data: [] })) // Logs are optional
      ])
        .then(([deploymentResponse, logsResponse]) => {
          // Convert backend deployment format to DeploymentDetails format
          const backendDeployment = deploymentResponse.data;
          const logs = logsResponse.data || [];
          
          // Map status from backend to frontend format
          const statusMap: Record<string, 'deploying' | 'running' | 'failed' | 'cancelled' | 'stopped'> = {
            'QUEUED': 'deploying',
            'PROCESSING': 'deploying',
            'DEPLOYING': 'deploying',
            'ACTIVE': 'running',
            'RUNNING': 'running',
            'CREATE_COMPLETE': 'running',
            'FAILED': 'failed',
            'CREATE_FAILED': 'failed',
            'DELETE_COMPLETE': 'stopped',
            'CANCELLED': 'cancelled',
            'DELETED': 'stopped',
          };
          
          const mappedStatus = statusMap[backendDeployment.status.toUpperCase()] || 'deploying';
          
          // Reverse logs to show newest first, then convert to steps format
          const reversedLogs = [...logs].reverse();
          
          // Find failed log to extract error message
          const failedLog = logs.find(log => 
            log.event_type.toLowerCase().includes('failed') || log.level === 'ERROR'
          );
          
          // Convert logs to steps format (newest first)
          const steps = reversedLogs.map((log, index) => {
            // Determine status: check if event_type contains "failed" or level is ERROR
            const isFailed = log.event_type.toLowerCase().includes('failed') || log.level === 'ERROR';
            const isWarning = log.level === 'WARNING';
            
            return {
              id: log.id,
              name: log.event_type.replace(/_/g, ' '),
              status: isFailed ? 'failed' as const : 
                     isWarning ? 'in-progress' as const : 
                     'completed' as const,
              startTime: log.created_at,
              endTime: index < reversedLogs.length - 1 ? reversedLogs[index + 1].created_at : undefined,
              description: log.message,
              icon: Server, // Default icon
            };
          });
          
          // Calculate progress based on status
          let progress = 0;
          if (mappedStatus === 'running') progress = 100;
          else if (mappedStatus === 'failed' || mappedStatus === 'cancelled') progress = 0;
          else if (mappedStatus === 'deploying') {
            // Calculate progress based on number of completed steps
            const completedSteps = steps.filter(s => s.status === 'completed').length;
            progress = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 50;
          }
          
          // Calculate resources from instances if available
          let cpu = 0, ram = 0, storage = 0;
          if (backendDeployment.instances && backendDeployment.instances.length > 0) {
            // Try to extract resource info from deployment_parameters or instances
            // This is a simplified calculation - adjust based on actual data structure
            cpu = backendDeployment.instances.length * 2; // Assume 2 cores per instance
            ram = backendDeployment.instances.length * 4; // Assume 4GB per instance
            storage = backendDeployment.instances.length * 20; // Assume 20GB per instance
          }
          
          const convertedDeployment = {
            id: backendDeployment.id,
            name: backendDeployment.name || "Unnamed Deployment",
            status: mappedStatus,
            course: backendDeployment.course?.name || "Unknown Course",
            startedAt: backendDeployment.created_at,
            completedAt: mappedStatus === 'running' || mappedStatus === 'failed' ? backendDeployment.updated_at : undefined,
            progress,
            currentStep: steps.find(s => s.status === 'in-progress')?.name,
            steps,
            error: failedLog?.message || undefined,
            resources: {
              cpu,
              ram,
              storage,
            },
          };
          
          setDeploymentData(convertedDeployment);
          setLoadingDeployment(false);
        })
        .catch((error) => {
          console.error("Failed to load deployment:", error);
          setLoadingDeployment(false);
        });
    }
  }, [selectedDeploymentId, currentView]);

  const renderView = () => {
    if (deploymentActive && selectedTemplateId) {
      return (
        <DeploymentWizard
          templateId={selectedTemplateId}
          onCancel={handleCancelDeployment}
          onComplete={handleCompleteDeployment}
        />
      );
    }

    if (currentView === "deployment-details") {
      // If we have a deployment ID, use the loaded deployment data
      if (selectedDeploymentId && deploymentData) {
        if (loadingDeployment) {
          return <div className="p-6">Lade Deployment...</div>;
        }
        return <DeploymentDetails deployment={deploymentData} onBack={handleBackToDashboard} />;
      }
      // Otherwise, use the mock deployment (for backward compatibility)
      if (selectedDeployment) {
        const deployment = mockDeployments[selectedDeployment as keyof typeof mockDeployments];
        if (deployment) {
          return <DeploymentDetails deployment={deployment} onBack={handleBackToDashboard} />;
        }
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
        case "documents":
        return <Documents />;
      case "admin":
        return <AdminMonitoring />;
      default:
        return <Dashboard onSelectDeployment={handleSelectDeployment} />;
    }
  };

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
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        logo={logo}
        deploymentActive={deploymentActive}

        //onLogout={() => keycloak.logout()}
      />
      <main className="flex-1 overflow-auto">{renderView()}</main>
    </div>
  );
}
