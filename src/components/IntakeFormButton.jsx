// Floating "finish your intake form" button (top right of every patient
// screen). Only shown to a patient who chose "Do this later" on the
// first-login prompt; it disappears for good once the form is submitted
// (AuthContext.intakeCompleted flips to true).
import { useNavigate } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function IntakeFormButton() {
  const { userRole, intakeCompleted } = useAuth()
  const navigate = useNavigate()

  if (userRole !== 'patient' || intakeCompleted !== false) return null

  return (
    <button
      type="button"
      onClick={() => navigate('/patient/intake')}
      title="Complete your intake form"
      aria-label="Complete your intake form"
      // right-16 leaves room for the notification bell at the top right.
      className="fixed top-4 right-16 z-40 w-11 h-11 rounded-full bg-rose text-white shadow-md flex items-center justify-center hover:bg-plum transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
    >
      <ClipboardList size={20} />
      <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-amber border-2 border-white" />
    </button>
  )
}