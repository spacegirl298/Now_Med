import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, logout } = useAuth()
  const navigate = useNavigate()

  // Load remembered email on first render
  useEffect(() => {
    const saved = localStorage.getItem('rememberedEmail')
    if (saved) {
      setEmail(saved)
      setRememberMe(true)
    }
  }, [])

  async function handleLogin(e) {
    e.preventDefault()  // prevents page refresh on form submit
    setLoading(true)
    setError('')

    try {
      const result = await login(email, password)
      //if user hasn't verifid their email
      if (!result.user.emailVerified) {
        await logout()
        setError('Please verify your email before logging in. Check your inbox for the verification link.')
        setLoading(false)
        return
      }
      //remember email information - easier to login again 
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email)
      } else {
        localStorage.removeItem('rememberedEmail')
      }

      const userDoc = await getDoc(doc(db, 'users', result.user.uid))
      const role = userDoc.data().role
      //takes you to your dashboard
      if (role === 'patient') navigate('/patient/dashboard')
      else navigate('/secretary/dashboard')
      //error handling with incorrect login information
    } catch (err) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Incorrect email or password')
      } else if (err.code === 'auth/user-not-found') {
        setError('No account found with this email')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many attempts. Please try again later.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    }

    setLoading(false)
  }
  //Layout of the section
  return (
    <div className="min-h-screen bg-mist flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold text-ink mb-1">Welcome back</h1>
      <p className="text-slate text-sm mb-8">Log in to your Now Med account</p>

      <form
        onSubmit={handleLogin}
        autoComplete="on"
        className="w-full max-w-sm flex flex-col gap-4"
      >
        <input
          placeholder="Email address"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
        />

        <div className="relative">
          <input
            placeholder="Password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
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

        {/* Remember me */}
        <label className="flex items-center gap-3 text-sm text-slate cursor-pointer">
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={e => setRememberMe(e.target.checked)}
            className="accent-rose"
          />
          Remember me
        </label>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          type="submit"
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
      </form>
    </div>
  )
}