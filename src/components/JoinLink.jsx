// The "join online consult" control for patients. Shows the real link only
// while the join window is open (see getJoinWindow in utils/meeting.js);
// before that it says when the link opens, and after the window it shows
// nothing. Re-checks every 30 seconds so it opens without a refresh.
import { useEffect, useState } from 'react'
import { Video } from 'lucide-react'
import { getJoinWindow, safeMeetingLink } from '../utils/meeting'
import { formatTime } from '../utils/dateHelpers'

// Same 12-hour style as the rest of the app (e.g. "3:50 PM").
function clock(date) {
  return formatTime(
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
  )
}

// variant "button" = full-width button; "pill" = compact button; "text" = small inline link.
export default function JoinLink({ appointment, variant = 'button', className = '' }) {
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30 * 1000)
    return () => clearInterval(id)
  }, [])

  const link = safeMeetingLink(appointment)
  if (!link) {
    return variant === 'button' ? (
      <p className={`text-xs text-slate flex items-center gap-1.5 ${className}`}>
        <Video size={14} className="text-rose shrink-0" />
        Your online meeting link will appear here once the practice has sent it.
      </p>
    ) : null
  }

  const { state, opensAt } = getJoinWindow(appointment, nowMs)
  if (state === 'closed') return null

  if (state === 'early') {
    const sameDay = opensAt && opensAt.toDateString() === new Date(nowMs).toDateString()
    const text = sameDay
      ? `Join link opens at ${clock(opensAt)}`
      : 'Join link opens 10 minutes before your appointment'
    return (
      <p className={`text-xs text-slate flex items-center gap-1.5 ${className}`}>
        <Video size={variant === 'button' ? 14 : 12} className="text-rose shrink-0" />
        {text}
      </p>
    )
  }

  if (variant === 'text') {
    return (
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className={`text-xs font-medium text-rose hover:underline inline-flex items-center gap-1 ${className}`}
      >
        <Video size={12} /> Join online
      </a>
    )
  }
  if (variant === 'pill') {
    return (
      <a
        href={link}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex items-center gap-1.5 text-xs font-medium text-white bg-rose rounded-lg px-3 py-2 hover:bg-plum transition-colors ${className}`}
      >
        <Video size={13} /> Join online consult
      </a>
    )
  }
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center justify-center gap-2 bg-rose text-white rounded-xl py-3 text-sm font-medium hover:bg-plum transition-colors ${className}`}
    >
      <Video size={18} />
      Join online consult
    </a>
  )
}
