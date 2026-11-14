// First screen for anyone who isn't signed in. The main path is for brand-new
// patients ("Get started" -> sign-up as a patient); people who already have an
// account get a smaller "Log in" option underneath. The "Welcome back" greeting
// lives on the login page itself, after they've chosen to log in.
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { CalendarCheck, MessageSquare, Navigation } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const HIGHLIGHTS = [
  { icon: CalendarCheck, text: 'Book in a few taps' },
  { icon: Navigation, text: 'Know when to leave' },
  { icon: MessageSquare, text: 'Message your practice' },
]

export default function Welcome() {
  const { currentUser, userRole } = useAuth()
  const navigate = useNavigate()

  // Already signed in (e.g. opened the home screen shortcut): skip straight in.
  if (currentUser && userRole) {
    return (
      <Navigate
        to={userRole === 'patient' ? '/patient/dashboard' : '/secretary/dashboard'}
        replace
      />
    )
  }

  return (
    <div className="min-h-screen bg-mist flex flex-col items-center justify-between px-6 py-10 safe-top safe-bottom">
      <div />

      <div className="w-full max-w-sm text-center">
        <p
          className="text-5xl font-extrabold tracking-tight text-plum uppercase mb-2"
          style={{ fontFamily: "'Bricolage Grotesque', 'DM Sans', sans-serif" }}
        >
          Now Med
        </p>
        <h1 className="text-sm font-semibold text-rose uppercase tracking-wide mb-4">
          Turning now now into now
        </h1>
        <p className="text-slate text-sm mb-8">
          Create your free account to book appointments, see live updates about
          your visit and keep your health records in one place.
        </p>

        <ul className="flex justify-center gap-2 mb-8 text-[11px] text-slate">
          {HIGHLIGHTS.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex-1 flex flex-col items-center gap-1.5 bg-white rounded-2xl px-2 py-3"
            >
              <Icon size={18} className="text-rose" />
              {text}
            </li>
          ))}
        </ul>

        <button
          onClick={() => navigate('/signup?role=patient')}
          className="w-full bg-rose text-white rounded-xl py-4 font-semibold text-base hover:bg-plum transition-colors"
        >
          Get started
        </button>
        <p className="text-xs text-slate mt-3">It only takes a minute.</p>
      </div>

      <div className="w-full max-w-sm text-center">
        <p className="text-sm text-slate">
          Already have an account?{' '}
          <Link to="/login" className="text-rose font-semibold py-2 inline-block">
            Log in
          </Link>
        </p>
        <p className="text-xs text-stone mt-1">
          Practice staff?{' '}
          <Link to="/signup?role=secretary" className="underline hover:text-slate">
            Staff sign-up
          </Link>
        </p>
      </div>
    </div>
  )
}
