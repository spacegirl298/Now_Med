// Mobile navigation. Bottom tab bar, keeps 5 core destinations always visible.
import { NavLink } from 'react-router-dom'
import { Calendar, Users, User, LayoutDashboard, MessageSquare } from 'lucide-react'
import { useUnreadMessages } from '../hooks/useUnreadMessages'

const PATIENT_LINKS = [
  { to: '/patient/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/patient/calendar', label: 'Calendar', icon: Calendar },
  { to: '/patient/records', label: 'Records', icon: Users },
  { to: '/patient/messages', label: 'Messages', icon: MessageSquare, showUnread: true },
  { to: '/patient/profile', label: 'Profile', icon: User },
]

const SECRETARY_LINKS = [
  { to: '/secretary/dashboard', label: 'Schedule', icon: LayoutDashboard },
  { to: '/secretary/schedule', label: 'Calendar', icon: Calendar },
  { to: '/secretary/patients', label: 'Patients', icon: Users },
  { to: '/secretary/messages', label: 'Messages', icon: MessageSquare, showUnread: true },
  { to: '/secretary/profile', label: 'Profile', icon: User },
]

export default function BottomTabBar({ role = 'secretary' }) {
  const links = role === 'patient' ? PATIENT_LINKS : SECRETARY_LINKS
  const unread = useUnreadMessages()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-sand flex justify-around py-2 z-40">
      {links.map(({ to, label, icon: Icon, showUnread }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 px-2 py-1 text-xs font-medium ${
              isActive ? 'text-rose' : 'text-slate'
            }`
          }
        >
          <span className="relative">
            <Icon size={20} />
            {showUnread && unread > 0 && (
              <span
                className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-rose text-white text-[10px] font-semibold flex items-center justify-center"
                aria-label={`${unread} unread messages`}
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}