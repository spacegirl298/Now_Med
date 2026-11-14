// First screen for anyone who isn't signed in. Same split layout as log in and
// sign up, so the whole entry flow feels like one place. The main path is for
// brand-new patients ("Get started"); people with an account get a clear
// "Log in" button beside it, and staff get a quiet link underneath.
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { CalendarCheck, MessageSquare, Navigation } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import AuthShell, { primaryButtonClass } from '../../components/AuthShell'

const HIGHLIGHTS = [
  { icon: CalendarCheck, title: 'Book in a few taps', text: 'Pick a time that suits you.' },
  { icon: Navigation, title: 'Know when to leave', text: 'Live updates on your visit.' },
  { icon: MessageSquare, title: 'Message your practice', text: 'Ask a question, get an answer.' },
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
    <AuthShell variant="patient">
      <h1 className="text-3xl font-semibold text-ink mb-2">Create your free account</h1>
      <p className="text-slate mb-8">
        Book appointments, follow your visit and keep your health records in one place.
      </p>

      <ul className="flex flex-col gap-4 mb-10">
        {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-center gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-rose">
              <Icon size={20} />
            </span>
            <span>
              <span className="block font-medium text-ink">{title}</span>
              <span className="block text-sm text-slate">{text}</span>
            </span>
          </li>
        ))}
      </ul>

      <button onClick={() => navigate('/signup?role=patient')} className={primaryButtonClass}>
        Get started
      </button>
      <p className="text-sm text-slate mt-3 text-center">It only takes a minute.</p>

      <div className="mt-10 flex items-center justify-between text-sm text-slate">
        <span>
          Already have an account?{' '}
          <Link to="/login" className="text-rose font-semibold py-2 inline-block">
            Log in
          </Link>
        </span>
        <Link to="/signup?role=secretary" className="hover:text-ink py-2">
          Practice staff
        </Link>
      </div>
    </AuthShell>
  )
}
