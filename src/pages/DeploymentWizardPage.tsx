import { useParams, useNavigate, Navigate, useLocation } from "react-router-dom";
import { DeploymentWizard, type DeploymentWizardInitialState } from "./DeploymentWizard";

// Router-state contract used by the "Erneut versuchen" flow on the deployment
// details page. The retry handler navigates to /deploy/:templateId with
// `state: { retryFrom: DeploymentWizardInitialState }`, which we forward to
// the wizard so it can pre-fill the overview step.
type WizardLocationState = {
  retryFrom?: DeploymentWizardInitialState;
};

export function DeploymentWizardPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const retryFrom = (location.state as WizardLocationState | null)?.retryFrom;

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
      initialState={retryFrom}
    />
  );
}
