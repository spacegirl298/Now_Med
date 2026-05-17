//Greeting with date & practice name
//Summary stats: upcoming appointments count, current delay duration, records count
//Delay notification - listen to Firestore in real time
//Upcoming appointments list with status badges
//Recent medical records lsit
//Quick action buttons: book appointments, my records, doctor profile, my profile
//use Firestore onSnapshot() listeners so delay updates appear without refresh
import { useAuth } from '../../context/AuthContext'

export default function PatientDashboard() {
  const { currentUser } = useAuth()

  return (
    <div className="min-h-screen bg-mist flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold text-ink mb-1">Welcome back, {currentUser?.displayName || currentUser?.email}</h1>
      
      <p className="text-slate text-sm mb-8">This is the patient dashboard</p>
    </div>
  )
}