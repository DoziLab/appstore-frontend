import { useParams, useNavigate, Navigate } from "react-router-dom";
import { DeploymentWizard } from "./DeploymentWizard";

export function DeploymentWizardPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();

  const handleCancel = () => {
    navigate("/appstore");
  };

  const handleComplete = (deploymentId: string) => {
    navigate(`/deployment/${deploymentId}`);
  };

  if (!templateId) {
    return <Navigate to="/appstore" replace />;
  }

  return (
    <DeploymentWizard
      templateId={templateId}
      onCancel={handleCancel}
      onComplete={handleComplete}
    />
  );
}
