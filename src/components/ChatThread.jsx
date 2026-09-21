// Message list + composer shared by the patient's Messages page and the
// secretary's inbox. Purely presentational: the parent owns the Firestore
// subscription and passes `onSend`.
//
// `myRole` decides which side the bubbles sit on. Messages with
// kind === 'reminder' (sent by the practice via "Send reminder") get their
// own amber style so they stand out from normal chat.
import { useEffect, useRef, useState } from 'react'
import { Bell, Send } from 'lucide-react'
import { formatDate, formatShortDate, formatTime, isToday } from '../utils/dateHelpers'

const MAX_LENGTH = 1000

// Pending writes have no server timestamp yet - treat them as "now".
function toDate(ts) {
  if (!ts) return new Date()
  if (ts.toDate) return ts.toDate()
  if (ts.seconds) return new Date(ts.seconds * 1000)
  return new Date(ts)
}

function timeLabel(d) {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return formatTime(`${hh}:${mm}`)
}

export default function ChatThread({
  messages,
  myRole,
  onSend,
  loading = false,
  emptyMessage = 'No messages yet.',
  placeholder = 'Write a message...',
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  async function submit() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setError('')
    try {
      await onSend(body)
      setText('')
    } catch (err) {
      console.error(err)
      setError(
        err?.code === 'permission-denied'
          ? "You don't have permission to send messages here."
          : 'Could not send your message. Please try again.',
      )
    }
    setSending(false)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  let lastDay = ''

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {loading ? (
          <p className="text-sm text-slate text-center py-10">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate text-center py-10">{emptyMessage}</p>
        ) : (
          messages.map((m) => {
            const d = toDate(m.createdAt)
            const day = formatDate(d)
            const showDay = day !== lastDay
            lastDay = day
            const mine = m.senderRole === myRole
            const isReminder = m.kind === 'reminder'

            return (
              <div key={m.id} className="flex flex-col gap-2">
                {showDay && (
                  <p className="text-xs text-slate text-center my-2">
                    {isToday(day) ? 'Today' : formatShortDate(day)}
                  </p>
                )}
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      isReminder
                        ? 'bg-pastel-amber text-ink rounded-bl-md'
                        : mine
                          ? 'bg-rose text-white rounded-br-md'
                          : 'bg-white text-ink border border-stone rounded-bl-md'
                    }`}
                  >
                    {isReminder && (
                      <p className="text-xs font-medium text-amber flex items-center gap-1 mb-1">
                        <Bell size={12} /> Reminder
                      </p>
                    )}
                    {!mine && !isReminder && m.senderName && (
                      <p className="text-xs font-medium text-slate mb-0.5">{m.senderName}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={`text-[11px] mt-1 ${mine && !isReminder ? 'text-white/70' : 'text-slate'}`}>
                      {timeLabel(d)}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="border-t border-sand bg-white px-4 py-3">
        {error && <p className="text-xs text-red mb-2">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            rows={1}
            maxLength={MAX_LENGTH}
            aria-label="Message"
            className="flex-1 resize-none max-h-32 border border-stone rounded-xl px-4 py-2.5 text-sm text-ink focus:border-rose focus:outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={sending || !text.trim()}
            aria-label="Send message"
            className="shrink-0 w-11 h-11 rounded-xl bg-rose text-white flex items-center justify-center hover:bg-plum transition-colors disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}