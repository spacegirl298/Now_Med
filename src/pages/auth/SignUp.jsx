import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { sendEmailVerification } from 'firebase/auth'
import { auth } from '../../firebase/config'

const VALID_PRACTICE_CODE = 'NM001'

export default function SignUp() {
  const [step, setStep] = useState(1)
  const [role, setRole] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', practiceCode: '', agreedToTerms: false
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [resendMessage, setResendMessage] = useState('')

  const { register } = useAuth()
  const navigate = useNavigate()

  // Countdown timer
  useEffect(() => {
    if (step !== 3) return

    setCountdown(60)
    setCanResend(false)

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setCanResend(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [step])

  async function handleResend() {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser)
        setResendMessage('Verification email resent! Check your inbox and spam folder.')
        setCanResend(false)
        setCountdown(60)

        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer)
              setCanResend(true)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      }
    } catch {
      setResendMessage('Could not resend email. Please try again.')
    }
  }

  async function handleSubmit() {
    if (!formData.name || !formData.email || !formData.password) {
      return setError('Please fill in all fields')
    }
    if (formData.password.length < 6) {
      return setError('Password must be at least 6 characters')
    }
    if (role === 'secretary' && !formData.agreedToTerms) {
      return setError('You must agree to the terms')
    }
    if (role === 'secretary' && !formData.practiceCode) {
      return setError('Practice code is required')
    }
    if (role === 'secretary' && formData.practiceCode !== VALID_PRACTICE_CODE) {
      return setError('Invalid practice code. Please contact your practice manager.')
    }

    setLoading(true)
    setError('')

    try {
      await register(
        formData.email,
        formData.password,
        role,
        formData.name,
        formData.practiceCode
      )
      setStep(3)
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists. Please log in instead.')
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters.')
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    }

    setLoading(false)
  }

  // Single main return — no early returns for any step
  return (
    <div className="min-h-screen bg-mist flex flex-col items-center justify-center p-6">

      {/* STEP 1 — Role selection */}
      {step === 1 && (
        <>
          <h1 className="text-2xl font-semibold text-ink mb-2">Create your account</h1>
          <p className="text-slate text-sm mb-8">Who are you signing up as?</p>

          <div className="flex flex-col gap-4 w-full max-w-sm">
            <button
              onClick={() => { setRole('patient'); setStep(2) }}
              className="bg-white border-2 border-sand rounded-2xl p-6 text-left hover:border-rose transition-colors"
            >
              <p className="font-semibold text-ink">Patient</p>
              <p className="text-sm text-slate mt-1">Book appointments and view your records</p>
            </button>

            <button
              onClick={() => { setRole('secretary'); setStep(2) }}
              className="bg-white border-2 border-sand rounded-2xl p-6 text-left hover:border-rose transition-colors"
            >
              <p className="font-semibold text-ink">Medical Secretary</p>
              <p className="text-sm text-slate mt-1">Manage appointments and patient records</p>
            </button>

            <p className="text-sm text-slate text-center mt-2">
              Already have an account?{' '}
              <Link to="/login" className="text-rose font-medium">Log in</Link>
            </p>
          </div>
        </>
      )}

      {/* STEP 2 — Details form */}
      {step === 2 && (
        <>
          <div className="w-full max-w-sm mb-8">
            <div className="flex gap-2">
              <div className="h-1 flex-1 rounded-full bg-rose" />
              <div className="h-1 flex-1 rounded-full bg-rose" />
              <div className="h-1 flex-1 rounded-full bg-sand" />
            </div>
            <p className="text-xs text-slate mt-2">Step 2 of 3 — Your details</p>
          </div>

          <div className="w-full max-w-sm flex flex-col gap-4">
            <input
              placeholder="Full name"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
            />
            <input
              placeholder="Email address"
              type="email"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
            />

            <div className="relative">
              <input
                placeholder="Password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={e => setFormData({...formData, password: e.target.value})}
                className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate text-sm hover:text-ink"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            {role === 'secretary' && (
              <>
                <input
                  placeholder="Practice code (e.g. NM001)"
                  value={formData.practiceCode}
                  onChange={e => setFormData({...formData, practiceCode: e.target.value})}
                  className="border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
                />
                <label className="flex items-center gap-3 text-sm text-slate cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.agreedToTerms}
                    onChange={e => setFormData({...formData, agreedToTerms: e.target.checked})}
                    className="accent-rose"
                  />
                  I confirm I am an authorised medical secretary
                </label>
              </>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-rose text-white rounded-xl py-3 font-medium hover:bg-plum transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating account...' : 'Continue'}
            </button>

            <button
              onClick={() => setStep(1)}
              className="text-sm text-slate text-center hover:text-ink"
            >
              ← Back
            </button>
          </div>
        </>
      )}

      {/* STEP 3 — Email verification with countdown */}
      {step === 3 && (
        <>
          <div className="w-full max-w-sm mb-8">
            <div className="flex gap-2">
              <div className="h-1 flex-1 rounded-full bg-rose" />
              <div className="h-1 flex-1 rounded-full bg-rose" />
              <div className="h-1 flex-1 rounded-full bg-rose" />
            </div>
            <p className="text-xs text-slate mt-2">Step 3 of 3 — Verify your email</p>
          </div>

          <h2 className="text-xl font-semibold text-ink mb-2">Check your email</h2>
          <p className="text-slate text-sm text-center mb-2">
            We sent a verification link to <strong>{formData.email}</strong>.
            Click the link to activate your account.
          </p>
          <p className="text-amber-600 text-xs text-center mb-8">
            ⚠️ Can't find it? Check your spam or junk folder.
          </p>

          {/* Countdown box — always visible */}
          <div className="bg-white rounded-2xl p-4 w-full max-w-sm text-center shadow-sm mb-6">
            {canResend ? (
              <>
                <p className="text-slate text-sm mb-3">Didn't receive the email?</p>
                <button
                  onClick={handleResend}
                  className="text-rose font-medium text-sm hover:underline"
                >
                  Resend verification email
                </button>
              </>
            ) : (
              <>
                <p className="text-slate text-sm mb-1">Email resend available in</p>
                <p className="text-4xl font-semibold text-rose">{countdown}</p>
                <p className="text-slate text-xs mt-1">seconds</p>
              </>
            )}
          </div>

          {resendMessage && (
            <p className="text-green-600 text-sm text-center mb-4">{resendMessage}</p>
          )}

          <button
            onClick={() => navigate('/login')}
            className="bg-rose text-white rounded-xl px-8 py-3 font-medium hover:bg-plum transition-colors"
          >
            Go to Login
          </button>
        </>
      )}

    </div>
  )
}