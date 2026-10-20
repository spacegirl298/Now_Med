import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { resetPassword } = useAuth();

  async function handleReset() {
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim());
      // Same message whether or not the account exists, so this page cannot
      // be used to find out which emails are registered.
      setMessage(
        "If an account exists for that email, we've sent a reset link. Check your inbox and spam folder.",
      );
    } catch (err) {
      console.error("Password reset failed:", err);
      if (err.code === "auth/invalid-email") {
        setError(
          "That email address does not look right. Please check it and try again.",
        );
      } else if (err.code === "auth/network-request-failed") {
        setError(
          "We could not connect. Check your internet connection and try again.",
        );
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please wait a few minutes and try again.");
      } else {
        setError(
          "Something went wrong on our side. Please try again in a moment.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-mist flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold text-ink mb-1">Reset password</h1>
      <p className="text-slate text-sm mb-8">
        We'll send a reset link to your email
      </p>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <input
          placeholder="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {message && <p className="text-green-600 text-sm">{message}</p>}

        <button
          onClick={handleReset}
          disabled={loading}
          className="bg-rose text-white rounded-xl py-3 font-medium hover:bg-plum transition-colors disabled:opacity-50"
        >
          {loading ? "Sending..." : "Send reset link"}
        </button>

        <Link to="/login" className="text-sm text-slate text-center">
          ← Back to login
        </Link>
      </div>
    </div>
  );
}
