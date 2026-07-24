import { useCurrentUser } from "../auth/useCurrentUser";

export function NoRolePage() {
  const user = useCurrentUser();

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="max-w-md p-8 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-4 bg-yellow-100 rounded-full">
            <svg
              className="w-8 h-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          
          <h1 className="mb-2 text-2xl font-bold text-gray-900">
            Keine Rolle zugewiesen
          </h1>
          
          <p className="mb-6 text-gray-600">
            Ihr Konto ({user.email || user.username || "unbekannt"}) hat noch keine Rolle zugewiesen.
          </p>
          
          <div className="p-4 mb-6 text-left bg-blue-50 rounded-lg">
            <h2 className="mb-2 text-sm font-semibold text-blue-900">
              Um Zugriff zu erhalten:
            </h2>
            <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
              <li>Kontaktieren Sie Ihren Administrator</li>
              <li>Fordern Sie eine passende Rolle an (Lecturer, Student, Admin)</li>
              <li>Nach der Zuweisung können Sie sich erneut anmelden</li>
            </ul>
          </div>
          
          <div className="text-sm text-gray-500">
            Nachdem Ihnen eine Rolle zugewiesen wurde, laden Sie bitte diese Seite neu.
          </div>
        </div>
      </div>
    </div>
  );
}
