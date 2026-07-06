// Mobile navigation. Bottom tab bar, keeps 4 core destinations always visible.
import { NavLink } from 'react-router-dom'
import { Calendar, Users, User, LayoutDashboard } from 'lucide-react'

const PATIENT_LINKS = [
  { to: '/patient/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/patient/calendar', label: 'Calendar', icon: Calendar },
  { to: '/patient/records', label: 'Records', icon: Users },
  { to: '/patient/profile', label: 'Profile', icon: User },
]

const SECRETARY_LINKS = [
  { to: '/secretary/dashboard', label: 'Schedule', icon: LayoutDashboard },
  { to: '/secretary/schedule', label: 'Calendar', icon: Calendar },
  { to: '/secretary/patients', label: 'Patients', icon: Users },
  { to: '/secretary/profile', label: 'Profile', icon: User },
]

export default function BottomTabBar({ role = 'secretary' }) {
  const links = role === 'patient' ? PATIENT_LINKS : SECRETARY_LINKS

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-sand flex justify-around py-2 z-40">
      {links.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-3 py-1 text-xs font-medium ${
              isActive ? 'text-rose' : 'text-slate'
            }`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
