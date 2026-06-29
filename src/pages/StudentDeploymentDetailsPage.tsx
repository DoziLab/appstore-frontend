import { useParams, Navigate } from "react-router-dom";
import { StudentDeploymentDetails } from "./StudentDeploymentDetails";

export function StudentDeploymentDetailsPage() {
  const { deploymentId } = useParams<{ deploymentId: string }>();
  if (!deploymentId) {
    return <Navigate to="/student/dashboard" replace />;
  }
  return <StudentDeploymentDetails deploymentId={deploymentId} />;
}
