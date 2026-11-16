import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export default function BackButton({ to, label = 'Back', className = '' }) {
  const navigate = useNavigate()

  function handleClick() {
    if (to) navigate(to)
    else navigate(-1)
  }

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-slate hover:text-ink transition-colors mb-4 ${className}`}
    >
      <ChevronLeft size={16} />
      {label}
    </button>
  )
}