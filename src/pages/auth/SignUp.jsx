import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { isValidEmail } from "../../utils/validators";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "../../firebase/config";
import AuthShell, {
  inputClass,
  primaryButtonClass,
  StepBar,
} from "../../components/AuthShell";

export default function SignUp() {
  // "Get started" on the welcome page arrives with ?role=patient and the staff
  // link with ?role=secretary; both skip the role picker (step 1).
  const [searchParams] = useSearchParams();
  const roleParam = searchParams.get("role");
  const presetRole =
    roleParam === "patient" || roleParam === "secretary" ? roleParam : "";
  const [step, setStep] = useState(presetRole ? 2 : 1);
  const [role, setRole] = useState(presetRole);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    idNumber: "",
    idType: "sa_id",
    password: "",
  });
  const [error, setError] = useState("");
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const { register } = useAuth();
  const navigate = useNavigate();

  // Countdown timer
  useEffect(() => {
    if (step !== 3) return;

    setCountdown(60); // eslint-disable-line react-hooks/set-state-in-effect -- reset the timer when verification step opens
    setCanResend(false);

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
  }, [step]);

  async function handleResend() {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        setResendMessage(
          "Verification email resent! Check your inbox and spam folder.",
        );
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
      }
    } catch {
      setResendMessage("Could not resend email. Please try again.");
    }
  }

  async function handleSubmit() {
    if (
      !formData.name ||
      !formData.email ||
      !formData.idNumber ||
      !formData.password
    ) {
      return setError("Please fill in all fields");
    }
    if (
      formData.idType === "sa_id" &&
      !/^\d{13}$/.test(formData.idNumber.trim())
    ) {
      return setError("Please enter a valid 13-digit South African ID number");
    }
    if (
      formData.idType === "passport" &&
      !/^[A-Za-z0-9]{5,15}$/.test(formData.idNumber.trim())
    ) {
      return setError("Please enter a valid passport number");
    }
    if (formData.password.length < 6) {
      return setError("Password must be at least 6 characters");
    }

    setLoading(true);
    setError("");

    try {
      await register(
        formData.email,
        formData.password,
        formData.idNumber,
        formData.idType,
        role,
        formData.name,
      );
      setStep(3);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError(
          "An account with this email already exists. Please log in instead.",
        );
      } else if (err.code === "auth/weak-password") {
        setError("Password must be at least 6 characters.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (
        err.code === "duplicate-id-number" ||
        err.code === "not-invited"
      ) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
        // Anything landing here is unexpected — log it so it's not a
        // silent dead end next time (e.g. permission-denied from a rules
        // change, a network error, etc).
        console.error("Sign up failed:", err);
      }
    }

    setLoading(false);
  }

  const emailError =
    touched.email && !isValidEmail(formData.email)
      ? "Enter a valid email address"
      : "";
  const isStaff = role === "secretary";
  const variant = isStaff
    ? "staff"
    : role === "patient"
      ? "patient"
      : "default";

  function set(field) {
    return (e) => setFormData({ ...formData, [field]: e.target.value });
  }

  function pickIdType(idType) {
    setFormData({ ...formData, idType, idNumber: "" });
  }

  // One shell for all three steps: the brand half never moves, only the
  // right half changes, so the flow reads as a single place.
  return (
    <AuthShell variant={variant} compact={step > 1}>
      {/* STEP 1 - Role selection */}
      {step === 1 && (
        <div>
          <h1 className="text-3xl font-semibold text-ink mb-1">
            Create your account
          </h1>
          <p className="text-slate mb-8">Who are you signing up as?</p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                setRole("patient");
                setStep(2);
              }}
              className="bg-white border-2 border-transparent rounded-2xl p-5 text-left hover:border-rose transition-colors focus-visible:outline-2 focus-visible:outline-rose"
            >
              <p className="font-semibold text-ink">Patient</p>
              <p className="text-sm text-slate mt-1">
                Book appointments and view your records
              </p>
            </button>

            <button
              onClick={() => {
                setRole("secretary");
                setStep(2);
              }}
              className="bg-white border-2 border-transparent rounded-2xl p-5 text-left hover:border-rose transition-colors focus-visible:outline-2 focus-visible:outline-rose"
            >
              <p className="font-semibold text-ink">Medical secretary</p>
              <p className="text-sm text-slate mt-1">
                Manage appointments and patient records
              </p>
            </button>
          </div>

          <p className="text-sm text-slate mt-8">
            Already have an account?{" "}
            <Link to="/login" className="text-rose font-semibold">
              Log in
            </Link>
          </p>
        </div>
      )}

      {/* STEP 2 - Details form */}
      {step === 2 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          noValidate
        >
          <StepBar step={2} />
          <h1 className="text-3xl font-semibold text-ink mb-1">
            {isStaff ? "Create your staff account" : "Create your account"}
          </h1>
          <p className="text-slate mb-6">
            {isStaff
              ? "Use your practice email address."
              : "Your details, so the practice can find you."}
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <input
              placeholder="Full name"
              autoComplete="name"
              value={formData.name}
              onChange={set("name")}
              className={inputClass}
            />
            <input
              placeholder="Email address"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={set("email")}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              aria-invalid={!!emailError}
              aria-describedby="email-error"
              className={inputClass}
            />
            {emailError && (
              <p
                id="email-error"
                role="alert"
                className="text-sm text-red-800 sm:col-span-2"
              >
                {emailError}
              </p>
            )}

            <div
              className="sm:col-span-2 flex gap-2"
              role="group"
              aria-label="ID type"
            >
              {[
                ["sa_id", "South African ID"],
                ["passport", "Passport / other ID"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={formData.idType === value}
                  onClick={() => pickIdType(value)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-medium border-2 transition-colors ${
                    formData.idType === value
                      ? "border-rose bg-blush/60 text-plum"
                      : "border-transparent bg-white text-slate hover:border-blush"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              placeholder={
                formData.idType === "sa_id"
                  ? "13-digit ID number"
                  : "Passport number"
              }
              inputMode={formData.idType === "sa_id" ? "numeric" : "text"}
              maxLength={formData.idType === "sa_id" ? 13 : 15}
              value={formData.idNumber}
              onChange={(e) => {
                const raw = e.target.value;
                const value =
                  formData.idType === "sa_id" ? raw.replace(/\D/g, "") : raw;
                setFormData({ ...formData, idNumber: value });
              }}
              className={inputClass}
            />
            <div className="relative">
              <input
                placeholder="Password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={formData.password}
                onChange={set("password")}
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
          </div>

          {error && (
            <p
              role="alert"
              className="mt-4 text-sm text-red bg-pastel-red rounded-xl px-4 py-3"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`${primaryButtonClass} mt-6`}
          >
            {loading ? "Creating account..." : "Continue"}
          </button>

          <div className="mt-5 flex items-center justify-between text-sm text-slate">
            <button
              type="button"
              onClick={() => (presetRole ? navigate("/") : setStep(1))}
              className="hover:text-ink py-2"
            >
              ← Back
            </button>
            <span>
              Already have an account?{" "}
              <Link to="/login" className="text-rose font-semibold">
                Log in
              </Link>
            </span>
          </div>
        </form>
      )}

      {/* STEP 3 - Email verification with countdown */}
      {step === 3 && (
        <div>
          <StepBar step={3} />
          <h1 className="text-3xl font-semibold text-ink mb-2">
            Check your email
          </h1>
          <p className="text-slate mb-1">
            We sent a verification link to{" "}
            <strong className="text-ink">{formData.email}</strong>. Open it to
            activate your account.
          </p>
          <p className="text-sm text-amber mb-6">
            Can't find it? Check your spam or junk folder.
          </p>

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
                <p className="text-slate text-sm">
                  You can resend the email in
                </p>
                <p className="text-3xl font-semibold text-rose tabular-nums">
                  {countdown}s
                </p>
              </>
            )}
          </div>

          {resendMessage && (
            <p role="status" className="text-green text-sm mb-3">
              {resendMessage}
            </p>
          )}

          <button
            onClick={() => navigate("/login")}
            className={`${primaryButtonClass} mt-3`}
          >
            Go to log in
          </button>
        </div>
      )}
    </AuthShell>
  );
}
