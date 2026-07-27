import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { resetPassword } = useAuth()

  async function handleReset() {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      await resetPassword(email)
      setMessage('Check your email for a password reset link')
    } catch {
      setError('Could not find an account with that email')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-mist flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold text-ink mb-1">Reset password</h1>
      <p className="text-slate text-sm mb-8">We'll send a reset link to your email</p>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <input
          placeholder="Email address"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {message && <p className="text-green-600 text-sm">{message}</p>}

        <button
          onClick={handleReset}
          disabled={loading}
          className="bg-rose text-white rounded-xl py-3 font-medium hover:bg-plum transition-colors disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send reset link'}
        </button>

        <Link to="/login" className="text-sm text-slate text-center">
          ← Back to login
        </Link>
      </div>
    </div>
  )
}