import { Link } from 'react-router-dom'

const DISPLAY = { fontFamily: "'Bricolage Grotesque', 'DM Sans', sans-serif" }

const PANEL_COPY = {
  default: {
    title: 'Your practice, on your time.',
    body: 'Book, follow your visit and message the practice from one place.',
  },
  patient: {
    title: 'Book in a few taps. Know when to leave.',
    body: 'Live updates on your visit, and your records kept together.',
  },
  staff: {
    title: 'The front desk, in one view.',
    body: 'Schedule, patient records and messages, kept in step.',
  },
}

export default function AuthShell({ variant = 'default', compact = false, children }) {
  const copy = PANEL_COPY[variant] || PANEL_COPY.default

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden bg-mist flex flex-col lg:flex-row">
      <aside
        className={`relative bg-plum text-white lg:w-1/2 lg:flex lg:flex-col lg:justify-between lg:p-14 px-6 lg:pt-14 overflow-hidden ${
          compact ? 'pb-12' : 'pb-16'
        } pt-[max(1.5rem,env(safe-area-inset-top))]`}
      >
        <Link to="/" aria-label="Now Med home" className="relative z-10 inline-block">
          <span
            className="text-2xl lg:text-3xl font-extrabold tracking-tight uppercase"
            style={DISPLAY}
          >
            Now Med
          </span>
        </Link>

        {/* Phones: the brand line, set large */}
        {!compact && (
          <p
            className="lg:hidden relative z-10 mt-8 font-extrabold leading-[0.85] tracking-tight select-none text-[4.25rem]"
            style={DISPLAY}
            aria-hidden="true"
          >
            <span className="block text-white/35 line-through decoration-2">now now</span>
            <span className="block">now.</span>
          </p>
        )}

        <div className="hidden lg:block relative z-10">
          <p
            className="font-extrabold leading-[0.85] tracking-tight select-none"
            style={{ ...DISPLAY, fontSize: 'clamp(5rem, 11vw, 9.5rem)' }}
            aria-hidden="true"
          >
            <span className="block text-white/35 line-through decoration-2">now now</span>
            <span className="block">now.</span>
          </p>
          <h2 className="mt-10 text-2xl font-semibold leading-snug max-w-md">{copy.title}</h2>
          <p className="mt-3 text-blush/90 max-w-md">{copy.body}</p>
        </div>

        {/* Soft rings, on every screen size */}
        <div
          className="absolute -right-24 -top-24 h-72 w-72 lg:-right-40 lg:-top-40 lg:h-[34rem] lg:w-[34rem] rounded-full border border-white/10"
          aria-hidden="true"
        />
        <div
          className="absolute -right-8 -top-8 h-44 w-44 lg:-right-16 lg:-top-16 lg:h-[22rem] lg:w-[22rem] rounded-full bg-rose/30"
          aria-hidden="true"
        />
      </aside>

      <main className="relative z-10 -mt-7 lg:mt-0 rounded-t-[2rem] lg:rounded-none bg-mist flex-1 lg:w-1/2 flex items-start lg:items-center justify-center px-6 pt-9 pb-[max(2rem,env(safe-area-inset-bottom))] lg:py-6 lg:overflow-y-auto">
        <div className="w-full max-w-md lg:max-w-lg">{children}</div>
      </main>
    </div>
  )
}

export const inputClass =
  'w-full bg-white border border-stone/70 rounded-xl px-4 py-3 text-ink placeholder:text-slate/60 focus:border-rose focus:outline-none focus:ring-2 focus:ring-rose/20'

export const primaryButtonClass =
  'w-full bg-rose text-white rounded-xl py-3.5 font-semibold hover:bg-plum transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose'

export function StepBar({ step, total = 3 }) {
  return (
    <div className="mb-6" role="group" aria-label={`Step ${step} of ${total}`}>
      <div className="flex gap-2">
        {Array.from({ length: total }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i < step ? 'bg-rose' : 'bg-blush/70'}`}
          />
        ))}
      </div>
    </div>
  )
}
