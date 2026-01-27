import { useNavigate } from "react-router-dom";
import { Dashboard } from "./Dashboard";

export function DashboardPage() {
  const navigate = useNavigate();

  const handleSelectDeployment = (deploymentName: string) => {
    // For mock deployments, we navigate with the name
    navigate(`/deployment/${deploymentName}`);
  };

  return <Dashboard onSelectDeployment={handleSelectDeployment} />;
}
