import { useNavigate } from "react-router-dom";
import { StudentDashboard } from "./StudentDashboard";

export function StudentDashboardPage() {
  const navigate = useNavigate();
  return (
    <StudentDashboard
      onSelectDeployment={(id) => navigate(`/student/deployment/${id}`)}
    />
  );
}
