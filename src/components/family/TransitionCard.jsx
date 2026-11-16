
import { CalendarClock } from 'lucide-react'
import Card from '../Card'
import { dateAtAge, daysUntil, transitionStage, MAJORITY_AGE, NOTICE_MONTHS } from '../../utils/childAge'
import { formatDisplayDate, formatDate } from '../../utils/dateHelpers'

export default function TransitionCard({ child }) {
  const turns18 = dateAtAge(child.dateOfBirth, MAJORITY_AGE)
  const days = daysUntil(turns18)
  const stage = transitionStage(child.dateOfBirth)
  const noticeDate = new Date(turns18)
  noticeDate.setMonth(noticeDate.getMonth() - NOTICE_MONTHS)
  const soon = stage === 'notice'
  const first = child.firstName || 'Your child'

  const steps = [
    {
      title: `${NOTICE_MONTHS} months before`,
      date: formatDate(noticeDate),
      text: `You and ${first} are reminded that the hand-over is coming.`,
      done: stage !== 'none',
    },
    {
      title: '18th birthday',
      date: formatDate(turns18),
      text: `Your access to ${first}'s information ends automatically.`,
      done: false,
    },
    {
      title: 'Your child takes over',
      text: `${first} signs up with the same ID number and the practice links their full history to their own account.`,
      done: false,
    },
  ]

  return (
    <Card className={soon ? 'border border-amber/40 bg-pastel-amber/40' : ''}>
      <div className="flex items-start gap-3 mb-4">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            soon ? 'bg-pastel-amber text-amber' : 'bg-mist text-rose'
          }`}
        >
          <CalendarClock size={20} />
        </span>
        <div>
          <h2 className="font-semibold text-ink">Handing over at 18</h2>
          <p className="text-sm text-slate">
            {first} turns 18 on {formatDisplayDate(formatDate(turns18))}
            {days > 0 ? ` (${days} day${days === 1 ? '' : 's'} to go).` : '.'}
          </p>
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {steps.map((s) => (
          <li key={s.title} className="flex gap-3">
            <span
              className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${s.done ? 'bg-rose' : 'bg-blush'}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{s.title}</p>
              <p className="text-sm text-slate">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  )
}
