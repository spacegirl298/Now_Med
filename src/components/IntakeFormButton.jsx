import { useNavigate } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function IntakeFormButton({ inline = false }) {
  const { userRole, intakeCompleted } = useAuth()
  const navigate = useNavigate()

  if (userRole !== 'patient' || intakeCompleted !== false) return null

  return (
    <button
      type="button"
      onClick={() => navigate('/patient/intake')}
      title="Complete your intake form"
      aria-label="Complete your intake form"
      className={`${
        inline ? "relative shrink-0" : "fixed top-4 right-13 z-40 shadow-md"
      } w-11 h-11 rounded-full bg-rose text-white flex items-center justify-center hover:bg-plum transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose`}
    >
      <ClipboardList size={20} />
      <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-amber border-2 border-white" />
    </button>
  )
}