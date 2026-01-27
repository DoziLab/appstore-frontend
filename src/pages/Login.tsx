import { useState } from "react";
import { Mail, Lock, AlertCircle } from "lucide-react";

interface LoginProps {
  onLogin: () => void;
  logo: string;
}

export function Login({ onLogin, logo }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Keycloak übernimmt Auth – wir redirecten nur
    onLogin();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-blue-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card Container */}
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-8 sm:p-10">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src={logo} alt="DoziLab" className="h-40 w-auto" />
          </div>

          {/* Icon & Title */}
          <div className="text-center mb-8">
            <h1 className="text-slate-900 mb-2">Willkommen!</h1>
            <p className="text-slate-500 text-sm">
              Melden Sie sich an, um auf Ihre Anwendungen zuzugreifen
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field
            <div>
              <label htmlFor="email" className="block text-sm text-slate-700 mb-2">
                E-Mail-Adresse
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ihre.email@uni.de"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div> */}

            {/* Password Field
            <div>
              <label htmlFor="password" className="block text-sm text-slate-700 mb-2">
                Passwort
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div> */}

            {/* Forgot Password
            <div className="flex justify-end">
              <button
                type="button"
                className="text-sm text-teal-600 hover:text-teal-700 transition-colors"
              >
                Passwort vergessen?
              </button>
            </div> */}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white py-3 rounded-lg transition-all shadow-lg shadow-teal-200/50 hover:shadow-xl hover:shadow-teal-300/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Anmeldung läuft...' : 'Anmelden mit Keycloak'}
            </button>
          </form>

          {/* Sign Up Link
          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            <p className="text-sm text-slate-600">
              Noch kein Konto?{' '}
              <button
                type="button"
                className="text-teal-600 hover:text-teal-700 transition-colors"
              >
                Jetzt registrieren
              </button>
            </p>
          </div> */}
        </div> 

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            DoziLab – Ihre Plattform für App-Deployment auf OpenStack
          </p>
        </div>
      </div>
    </div>
  );
}
