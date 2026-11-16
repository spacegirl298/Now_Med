import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { isValidEmail } from "../../utils/validators";
import AuthShell, {
  inputClass,
  primaryButtonClass,
} from "../../components/AuthShell";
import { useAuth } from "../../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState({});
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingRole, setAwaitingRole] = useState(false);
  const emailError =
    touched.email && !isValidEmail(email) ? "Enter a valid email address" : "";
  const { login, logout, currentUser, userRole } = useAuth();
  const navigate = useNavigate();

  // Remembered email
  useEffect(() => {
    const saved = localStorage.getItem("rememberedEmail");
    if (saved) {
      setEmail(saved); // eslint-disable-line react-hooks/set-state-in-effect -- initialize the form from browser storage
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    if (!awaitingRole || !currentUser || !userRole) return;
    if (userRole === "patient") navigate("/patient/dashboard");
    else navigate("/secretary/dashboard");
  }, [awaitingRole, currentUser, userRole, navigate]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await login(email, password);
      if (!result.user.emailVerified) {
        await logout();
        setError(
          "Please verify your email before logging in. Check your inbox for the verification link.",
        );
        setLoading(false);
        return;
      }
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
      } else {
        localStorage.removeItem("rememberedEmail");
      }

      setAwaitingRole(true);
      return;
    } catch (err) {
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Incorrect email or password");
      } else if (err.code === "auth/user-not-found") {
        setError("No account found with this email");
      } else if (err.code === "auth/no-profile") {
        setError(
          "We couldn't load your profile. Check your connection and try again.",
        );
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }

    setLoading(false);
  }
  // Sign-in form
  return (
    <AuthShell>
      <h1 className="text-3xl font-semibold text-ink mb-1">Welcome back</h1>
      <p className="text-slate mb-8">Log in to your Now Med account.</p>

      <form
        onSubmit={handleLogin}
        autoComplete="on"
        className="flex flex-col gap-3"
      >
        <input
          placeholder="Email address"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, email: true }))}
          aria-invalid={!!emailError}
          aria-describedby="email-error"
          className={inputClass}
        />
        {emailError && (
          <p id="email-error" role="alert" className="text-sm text-red-800">
            {emailError}
          </p>
        )}

        <div className="relative">
          <input
            placeholder="Password"
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} pr-16`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate text-sm hover:text-ink"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2.5 text-sm text-slate cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="accent-rose"
            />
            Remember me
          </label>
          <Link
            to="/forgot-password"
            className="text-sm text-rose font-medium py-2"
          >
            Forgot password?
          </Link>
        </div>

        {error && (
          <p
            role="alert"
            className="text-sm text-red bg-pastel-red rounded-xl px-4 py-3"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`${primaryButtonClass} mt-1`}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <div className="mt-8 flex items-center justify-between text-sm text-slate">
        <Link to="/" className="hover:text-ink py-2">
          ← Back
        </Link>
        <span>
          New to Now Med?{" "}
          <Link to="/signup?role=patient" className="text-rose font-semibold">
            Create an account
          </Link>
        </span>
      </div>
    </AuthShell>
  );
}
