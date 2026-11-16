
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthShell, { primaryButtonClass } from '../components/AuthShell'

export default function NotFound() {
  const { currentUser, userRole } = useAuth()

  const signedIn = currentUser && userRole
  const home = !signedIn
    ? '/'
    : userRole === 'patient'
      ? '/patient/dashboard'
      : '/secretary/dashboard'

  return (
    <AuthShell>
      <p
        className="text-7xl font-extrabold tracking-tight text-rose mb-4"
        style={{ fontFamily: "'Bricolage Grotesque', 'DM Sans', sans-serif" }}
      >
        404
      </p>
      <h1 className="text-3xl font-semibold text-ink mb-2">We can't find that page</h1>
      <p className="text-slate mb-8">
        The link may be broken, or the page may have moved.
      </p>

      <Link to={home} className={`${primaryButtonClass} block text-center`}>
        {signedIn ? 'Back to my dashboard' : 'Back to the start'}
      </Link>
    </AuthShell>
  )
}
