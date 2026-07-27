import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { sendEmailVerification } from 'firebase/auth'

export default function EmailVerification() {
  const { currentUser } = useAuth()
  const [countdown, setCountdown] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [message, setMessage] = useState('')

  // Start countdown on load
  useEffect(() => {
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
  }, [])

  async function handleResend() {
    if (!currentUser) return

    try {
      await sendEmailVerification(currentUser)
      setMessage('Verification email resent!')
      setCanResend(false)
      setCountdown(60)

      // Restart the countdown
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
    } catch {
      setMessage('Could not resend email. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-mist flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold text-ink mb-2">Verify your email</h1>
      <p className="text-slate text-sm text-center mb-2">
        We sent a verification link to your email address.
        Click the link to activate your account.
      </p>
      <p className="text-amber-600 text-xs text-center mb-8">
        ⚠️ Can't find it? Check your spam or junk folder.
      </p>

      {message && (
        <p className="text-green-600 text-sm mb-4 text-center">{message}</p>
      )}

      {/* Countdown or resend button */}
      {canResend ? (
        <button
          onClick={handleResend}
          className="text-rose text-sm mb-6 hover:underline font-medium"
        >
          Resend verification email
        </button>
      ) : (
        <p className="text-slate text-sm mb-6">
          Resend available in{' '}
          <span className="text-rose font-medium">{countdown}s</span>
        </p>
      )}

      <Link
        to="/login"
        className="bg-rose text-white rounded-xl px-8 py-3 font-medium hover:bg-plum transition-colors"
      >
        Go to Login
      </Link>
    </div>
  )
}