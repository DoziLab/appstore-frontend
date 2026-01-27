import { useState, useEffect } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { Server } from "lucide-react";
import { DeploymentDetails } from "./DeploymentDetails";
import { mockDeployments } from "./mockDeployments";
import { getDeployment, getDeploymentLogs, deleteDeployment } from "../api/deployments";

export function DeploymentDetailsPage() {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  const navigate = useNavigate();
  const [deploymentData, setDeploymentData] = useState<any>(null);
  const [loadingDeployment, setLoadingDeployment] = useState(false);
  const [deletingDeployment, setDeletingDeployment] = useState(false);

  const handleBackToDashboard = () => {
    navigate("/dashboard");
  };

  const handleDeleteDeployment = async (id: string) => {
    try {
      setDeletingDeployment(true);
      const resp = await deleteDeployment(id);
      if (resp && typeof resp === 'object' && 'success' in resp && (resp as any).success) {
        navigate('/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Failed to delete deployment', err);
      navigate('/dashboard');
    } finally {
      setDeletingDeployment(false);
    }
  };

  // Load deployment when deploymentId changes
  useEffect(() => {
    if (!deploymentId) return;

    // Check if it's a mock deployment first
    const mockDeployment = mockDeployments[deploymentId as keyof typeof mockDeployments];
    if (mockDeployment) {
      setDeploymentData(mockDeployment);
      return;
    }

    // Otherwise load from API
    setLoadingDeployment(true);
    
    // Load deployment and logs in parallel
    Promise.all([
      getDeployment(deploymentId),
      getDeploymentLogs(deploymentId).catch(() => ({ data: [] })) // Logs are optional
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
  }, [deploymentId]);

  if (!deploymentId) {
    return <Navigate to="/dashboard" replace />;
  }

  if (loadingDeployment) {
    return <div className="p-6">Lade Deployment...</div>;
  }

  if (!deploymentData) {
    return <div className="p-6">Deployment nicht gefunden</div>;
  }

  return <DeploymentDetails deployment={deploymentData} onBack={handleBackToDashboard} onDelete={handleDeleteDeployment} />;
}
