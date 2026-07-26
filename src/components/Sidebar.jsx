// Desktop navigation. Persistent left sidebar, links vary by role.
import { NavLink, useNavigate } from 'react-router-dom'
import { Calendar, Users, User, LayoutDashboard, LogOut } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const PATIENT_LINKS = [
  { to: '/patient/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/patient/calendar', label: 'Calendar', icon: Calendar },
  { to: '/patient/records', label: 'Records', icon: Users },
  { to: '/patient/profile', label: 'Profile', icon: User },
]

const SECRETARY_LINKS = [
  { to: '/secretary/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/secretary/schedule', label: 'Schedule', icon: Calendar },
  { to: '/secretary/patients', label: 'Patients', icon: Users },
  { to: '/secretary/profile', label: 'Profile', icon: User },
]

export default function Sidebar({ role = 'secretary' }) {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const links = role === 'patient' ? PATIENT_LINKS : SECRETARY_LINKS

  // logout() only signs the user out of Firebase — it doesn't navigate
  // anywhere on its own. Without an explicit redirect here, the app can be
  // left showing a stale, now-unauthenticated page instead of returning to
  // the login screen, which is what made this look "broken".
  async function handleLogout() {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      console.error('Could not log out:', error)
    }
  }

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 bg-plum text-white h-screen sticky top-0 overflow-y-auto px-4 py-6">
      <div className="mb-8 px-2">
        <p className="text-lg font-semibold">Now Med</p>
        <p className="text-xs text-blush">
          {role === 'secretary' ? 'Secretary Portal' : 'Patient Portal'}
        </p>
      </div>

      <nav className="flex-1 flex flex-col gap-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                isActive ? 'bg-rose text-white' : 'text-blush hover:bg-deep-plum'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-blush hover:bg-deep-plum transition-colors"
      >
        <LogOut size={18} />
        Log out
      </button>
    </aside>
  )
}