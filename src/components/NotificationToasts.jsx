// In-app banners for brand-new notifications (see useNotificationAlerts).
// Sits at the top of the screen, below the phone's status bar, above content.
import { useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'

export default function NotificationToasts({ toasts, onDismiss }) {
  const navigate = useNavigate()
  if (!toasts.length) return null

  return (
    <div
      className="fixed top-2 left-2 right-2 sm:left-auto sm:right-4 sm:w-96 z-[70] flex flex-col gap-2 safe-top pointer-events-none"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-in pointer-events-auto flex items-start gap-3 bg-plum text-white rounded-2xl shadow-lg px-4 py-3"
        >
          <button
            type="button"
            onClick={() => {
              onDismiss(t.id)
              navigate(t.url)
            }}
            className="flex items-start gap-3 flex-1 min-w-0 text-left"
          >
            <Bell size={18} className="shrink-0 mt-0.5 text-blush" />
            <span className="text-sm leading-snug break-words">{t.message}</span>
          </button>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss notification"
            className="shrink-0 -m-2 w-10 h-10 flex items-center justify-center text-blush hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
