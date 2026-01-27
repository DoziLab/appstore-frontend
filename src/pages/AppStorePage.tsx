import { useNavigate } from "react-router-dom";
import { AppStore } from "./AppStore";

export function AppStorePage() {
  const navigate = useNavigate();

  const handleStartDeployment = (templateId: string) => {
    navigate(`/deploy/${templateId}`);
  };

  return <AppStore onDeploy={handleStartDeployment} />;
}
