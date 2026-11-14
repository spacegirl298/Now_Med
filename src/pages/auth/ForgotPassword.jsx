import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import AuthShell, { inputClass, primaryButtonClass } from "../../components/AuthShell";

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
    <AuthShell>
      <h1 className="text-3xl font-semibold text-ink mb-1">Reset your password</h1>
      <p className="text-slate mb-8">We'll email you a link to set a new one.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleReset();
        }}
        className="flex flex-col gap-3"
      >
        <input
          placeholder="Email address"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />

        {error && (
          <p role="alert" className="text-sm text-red bg-pastel-red rounded-xl px-4 py-3">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm text-green bg-pastel-green rounded-xl px-4 py-3">
            {message}
          </p>
        )}

        <button type="submit" disabled={loading} className={`${primaryButtonClass} mt-1`}>
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <Link to="/login" className="inline-block mt-8 text-sm text-slate hover:text-ink py-2">
        ← Back to log in
      </Link>
    </AuthShell>
  );
}
