import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useCurrentUser } from "../auth/useCurrentUser";

type ProtectedRouteProps = {
  children: ReactNode;
  requireAdmin?: boolean;
  requireLecturer?: boolean;
  requireStudent?: boolean;
};

/**
 * Schützt Routes basierend auf Benutzerrollen.
 * - Benutzer ohne Rolle werden zu /no-role umgeleitet
 * - Studenten werden zu /student/dashboard umgeleitet (außer bei requireStudent)
 * - Lecturer und Admins haben Zugriff basierend auf requireLecturer/requireAdmin
 */
export function ProtectedRoute({
  children,
  requireAdmin = false,
  requireLecturer = false,
  requireStudent = false,
}: ProtectedRouteProps) {
  const user = useCurrentUser();

  // User hat keine Rolle
  const hasNoRole = !user.isAdmin && !user.isLecturer && !user.isStudent;
  if (hasNoRole) {
    return <Navigate to="/no-role" replace />;
  }

  // Student versucht auf Lecturer/Admin-Seiten zuzugreifen
  if (user.isStudent && !user.isLecturer && !user.isAdmin && !requireStudent) {
    return <Navigate to="/student/dashboard" replace />;
  }

  // Spezifische Admin-Berechtigung erforderlich
  if (requireAdmin && !user.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Spezifische Lecturer-Berechtigung erforderlich
  if (requireLecturer && !user.isLecturer && !user.isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  // Spezifische Student-Berechtigung erforderlich
  if (requireStudent && !user.isStudent) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
