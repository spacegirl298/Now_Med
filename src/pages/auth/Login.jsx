import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleLogin() {
    setLoading(true)
    setError('')

    try {
      const result = await login(email, password)

      // Fetch role to redirect correctly
      const userDoc = await getDoc(doc(db, 'users', result.user.uid))
      const role = userDoc.data().role

      if (role === 'patient') navigate('/patient/dashboard')
      else navigate('/secretary/dashboard')

    } catch (err) {
      setError('Incorrect email or password')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-mist flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold text-ink mb-1">Welcome back</h1>
      <p className="text-slate text-sm mb-8">Log in to your Now Med account</p>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <input
          placeholder="Email address"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="bg-rose text-white rounded-xl py-3 font-medium hover:bg-plum transition-colors disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>

        <Link to="/forgot-password" className="text-sm text-rose text-center">
          Forgot password?
        </Link>

        <p className="text-sm text-slate text-center">
          Don't have an account?{' '}
          <Link to="/signup" className="text-rose font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  )
}