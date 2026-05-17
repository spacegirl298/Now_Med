//Header stats: todays total appointments, delayed count, confirmed count 
//Mini calendar with appointment dots on booked dates
//Todays appointment list (time, patient name, type, duration, status badge)
//Patient search bar (live search by name against users collection)
//Recent patients list with last visit date
import { useAuth } from '../../context/AuthContext'

export default function SecretaryDashboard() {
  const { currentUser } = useAuth()

  return (
    <div className="min-h-screen bg-mist flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold text-ink mb-1">Welcome back, {currentUser?.displayName || currentUser?.email}</h1>
      <p className="text-slate text-sm mb-8">This is the secretary dashboard</p>
    </div>
  )
}