import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock, User } from "lucide-react";
import Logo from "../components/Logo.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const [portal, setPortal] = useState("admin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { loginAdmin, loginEmployee } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (portal === "admin") {
        await loginAdmin(identifier, password);
      } else {
        await loginEmployee(identifier, password);
      }
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface bg-gradient-radial-soft flex items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col gap-6 animate-slideUp">
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="card p-8">
          <div className="inline-flex rounded-xl bg-hairline/[0.05] p-1 gap-1 mb-6 w-full">
            <button
              type="button"
              onClick={() => setPortal("admin")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                portal === "admin" ? "bg-surface-alt text-ink shadow-soft" : "text-muted"
              }`}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => setPortal("employee")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                portal === "employee" ? "bg-surface-alt text-ink shadow-soft" : "text-muted"
              }`}
            >
              Employee
            </button>
          </div>

          <h2 className="text-lg font-semibold text-ink mb-1">
            {portal === "admin" ? "Admin Login" : "Employee Login"}
          </h2>
          <p className="text-sm text-muted mb-6">
            {portal === "admin"
              ? "Sign in with your admin username and password."
              : "Sign in with your Employee ID and password."}
          </p>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="text-sm font-medium text-ink">
              {portal === "admin" ? "Username" : "Employee ID"}
              <div className="relative mt-1.5">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={portal === "admin" ? "admin" : "EMP001"}
                  className="input-field pl-10"
                  autoComplete="username"
                />
              </div>
            </label>

            <label className="text-sm font-medium text-ink">
              Password
              <div className="relative mt-1.5">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10"
                  autoComplete="current-password"
                />
              </div>
            </label>

            {error && <p className="text-sm text-danger">{error}</p>}

            <button
              type="submit"
              disabled={!identifier || !password || loading}
              className="btn-primary ripple flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
