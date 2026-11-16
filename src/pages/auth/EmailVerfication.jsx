import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { sendEmailVerification } from "firebase/auth";
import AuthShell, { primaryButtonClass } from "../../components/AuthShell";

export default function EmailVerification() {
  const { currentUser } = useAuth();
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [message, setMessage] = useState("");

  // Countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  async function handleResend() {
    if (!currentUser) return;

    try {
      await sendEmailVerification(currentUser);
      setMessage("Verification email resent!");
      setCanResend(false);
      setCountdown(60);

      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setMessage("Could not resend email. Please try again.");
    }
  }

  return (
    <AuthShell>
      <h1 className="text-3xl font-semibold text-ink mb-2">
        Verify your email
      </h1>
      <p className="text-slate mb-1">
        We sent a verification link to your email address. Open it to activate
        your account.
      </p>
      <p className="text-sm text-amber mb-6">
        Can't find it? Check your spam or junk folder.
      </p>

      {message && (
        <p role="status" className="text-sm text-green mb-3">
          {message}
        </p>
      )}

      <div className="bg-white rounded-2xl p-5 flex items-center justify-between gap-4 mb-3">
        {canResend ? (
          <>
            <p className="text-slate text-sm">Didn't receive it?</p>
            <button
              onClick={handleResend}
              className="text-rose font-semibold text-sm hover:underline"
            >
              Resend email
            </button>
          </>
        ) : (
          <>
            <p className="text-slate text-sm">You can resend the email in</p>
            <p className="text-3xl font-semibold text-rose tabular-nums">
              {countdown}s
            </p>
          </>
        )}
      </div>

      <Link
        to="/login"
        className={`${primaryButtonClass} block text-center mt-3`}
      >
        Go to log in
      </Link>
    </AuthShell>
  );
}
