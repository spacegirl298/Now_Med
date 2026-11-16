import { useMemo, useState, useEffect } from 'react'
import { ArrowLeft, CheckCircle2, Clock3, LockKeyhole, Plus, ShieldCheck, X } from 'lucide-react'
import Card from './Card'
import IntakeSummary from './IntakeSummary'
import { getVisibleQuestions, PHONE_COUNTRIES } from '../utils/intakeQuestions'

const inputClasses =
  'w-full border border-stone rounded-xl px-4 py-3 text-ink bg-white focus:border-rose focus:outline-none'
const primaryBtn =
  'bg-rose text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-plum transition-colors disabled:opacity-60'
const ghostBtn = 'text-sm text-slate hover:text-ink px-2 py-2'
const secondaryBtn =
  'border border-stone text-ink rounded-xl px-5 py-3 text-sm font-medium hover:border-rose hover:text-plum transition-colors disabled:opacity-60'

function chipClasses(selected) {
  return `px-4 py-2.5 rounded-full text-sm font-medium border transition-colors ${
    selected
      ? 'bg-rose text-white border-rose'
      : 'bg-white text-ink border-stone hover:border-rose'
  }`
}


function ListInput({ q, value, onChange, onDirtyChange }) {
  const blank = useMemo(
    () => Object.fromEntries(q.fields.map((f) => [f.key, f.options ? f.options[0] : ''])),
    [q],
  )
  const [yes, setYes] = useState(Array.isArray(value) && value.length > 0)
  const [draft, setDraft] = useState(blank)
  const [draftError, setDraftError] = useState('')
  const items = Array.isArray(value) ? value : []

  const isDirty = q.fields.some((f) => draft[f.key] && draft[f.key] !== blank[f.key])
  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  function addItem() {
    const missing = q.fields.find((f) => f.required && !draft[f.key].trim())
    if (missing) {
      setDraftError('Fill in the first field to add this entry.')
      return
    }
    const clean = Object.fromEntries(
      Object.entries(draft).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]),
    )
    onChange([...items, clean])
    setDraft(blank)
    setDraftError('')
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addItem()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={!yes && Array.isArray(value)}
          onClick={() => {
            setYes(false)
            setDraft(blank)
            setDraftError('')
            onChange([])
          }}
          className={chipClasses(!yes && Array.isArray(value))}
        >
          No
        </button>
        <button
          type="button"
          aria-pressed={yes}
          onClick={() => setYes(true)}
          className={chipClasses(yes)}
        >
          Yes
        </button>
      </div>

      {yes && (
        <>
          {items.length > 0 && (
            <ul className="flex flex-col gap-2">
              {items.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 bg-mist rounded-xl px-4 py-2.5 text-sm text-ink"
                >
                  <span className="min-w-0 break-words">{q.summarize(item)}</span>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    aria-label="Remove entry"
                    className="text-slate hover:text-red shrink-0"
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="border border-stone rounded-xl p-4 flex flex-col gap-3" onKeyDown={onKeyDown}>
            {q.fields.map((f, i) => (
              <div key={f.key}>
                <label className="text-xs text-slate mb-1 block">{f.label}</label>
                {f.options ? (
                  <select
                    value={draft[f.key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    className={inputClasses}
                  >
                    {f.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={f.type === 'date' ? 'date' : 'text'}
                    max={f.type === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
                    value={draft[f.key]}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className={inputClasses}
                    autoFocus={i === 0 && items.length === 0}
                  />
                )}
              </div>
            ))}
            {draftError && <p className="text-red text-xs">{draftError}</p>}
            <button
              type="button"
              onClick={addItem}
              className="self-start flex items-center gap-1.5 text-sm font-medium text-rose hover:underline"
            >
              <Plus size={16} /> {q.addLabel}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ---------- Input for the current question ----------

function QuestionInput({ q, answers, setAnswer, onDirtyChange }) {
  const value = answers[q.id]

  switch (q.type) {
    case 'text':
    case 'tel':
      return (
        <input
          type={q.type === 'tel' ? 'tel' : 'text'}
          inputMode={q.type === 'tel' ? 'tel' : undefined}
          value={value || ''}
          onChange={(e) => setAnswer(q.id, e.target.value)}
          placeholder={q.placeholder}
          className={inputClasses}
          autoFocus
        />
      )
    case 'phone': {
      const phone = typeof value === 'string'
        ? { country: PHONE_COUNTRIES[0].value, number: value }
        : value || { country: PHONE_COUNTRIES[0].value, number: '' }
      return (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
          <select
            value={phone.country || PHONE_COUNTRIES[0].value}
            onChange={(e) => setAnswer(q.id, { ...phone, country: e.target.value })}
            className={inputClasses}
            aria-label="Country calling code"
          >
            {PHONE_COUNTRIES.map((country) => (
              <option key={country.value} value={country.value}>
                {country.label}
              </option>
            ))}
          </select>
          <input
            type="tel"
            inputMode="tel"
            value={phone.number || ''}
            onChange={(e) => setAnswer(q.id, { ...phone, number: e.target.value })}
            placeholder="Phone number"
            className={inputClasses}
            autoFocus
          />
        </div>
      )
    }
    case 'textarea':
      return (
        <textarea
          value={value || ''}
          onChange={(e) => setAnswer(q.id, e.target.value)}
          placeholder={q.placeholder}
          rows={4}
          className={inputClasses}
          autoFocus
        />
      )
    case 'date':
      return (
        <input
          type="date"
          value={value || ''}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setAnswer(q.id, e.target.value)}
          className={inputClasses}
          autoFocus
        />
      )
    case 'single':
      return (
        <div className="flex flex-wrap gap-2">
          {q.options.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={value === o.value}
              onClick={() => setAnswer(q.id, o.value)}
              className={chipClasses(value === o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )
    case 'multi': {
      const selected = Array.isArray(value) ? value : []
      const toggle = (v) =>
        setAnswer(q.id, selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {q.options.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={selected.includes(o.value)}
                onClick={() => toggle(o.value)}
                className={chipClasses(selected.includes(o.value))}
              >
                {o.label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={Array.isArray(value) && selected.length === 0 && !answers[q.otherKey]}
              onClick={() => {
                setAnswer(q.id, [])
                if (q.otherKey) setAnswer(q.otherKey, '')
              }}
              className={chipClasses(
                Array.isArray(value) && selected.length === 0 && !answers[q.otherKey],
              )}
            >
              None of these
            </button>
          </div>
          {q.otherKey && (
            <div>
              <label className="text-xs text-slate mb-1 block">Something else? (optional)</label>
              <input
                value={answers[q.otherKey] || ''}
                onChange={(e) => {
                  setAnswer(q.otherKey, e.target.value)
                  if (value === undefined) setAnswer(q.id, [])
                }}
                className={inputClasses}
              />
            </div>
          )}
        </div>
      )
    }
    case 'list':
      return (
        <ListInput
          key={q.id}
          q={q}
          value={value}
          onChange={(v) => setAnswer(q.id, v)}
          onDirtyChange={onDirtyChange}
        />
      )
    case 'consent':
      return (
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => setAnswer(q.id, e.target.checked)}
            className="mt-1 h-4 w-4 accent-rose"
          />
          <span className="text-sm text-ink">{q.consentText}</span>
        </label>
      )
    default:
      return null
  }
}

// ---------- Wizard ----------

const NO_ANSWERS = {}

export default function IntakeWizard({
  initialAnswers = NO_ANSWERS,
  lockedAnswers = NO_ANSWERS,
  intro,
  onLater,
  onSubmit,
  consentTextOverride,
}) {
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState(() => ({ ...initialAnswers, ...lockedAnswers }))
  const [index, setIndex] = useState(0)
  const [stepError, setStepError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [fromReview, setFromReview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const allQuestions = useMemo(() => getVisibleQuestions(answers), [answers])
  const steps = useMemo(() => allQuestions.filter((x) => x.type !== 'consent'), [allQuestions])
  const consentQuestion = allQuestions.find((x) => x.type === 'consent')
  const consentQ =
    consentQuestion && consentTextOverride
      ? { ...consentQuestion, consentText: consentTextOverride }
      : consentQuestion
  const inReview = index >= steps.length
  const q = steps[index]
  const progress = Math.round((Math.min(index, steps.length) / steps.length) * 100)

  function setAnswer(key, value) {
    setAnswers((prev) => ({ ...prev, [key]: value }))
    setStepError('')
    setError('')
  }

  function go(next) {
    setDirty(false)
    setStepError('')
    setIndex(next)
  }

  function validateStep() {
    if (dirty) return 'Tap “Add” to keep this entry, or clear it, before continuing.'
    const v = answers[q.id]
    const empty = v === undefined || v === '' || v === false || (Array.isArray(v) && v.length === 0 && q.type !== 'list')
    if (q.required && empty) return 'This question is required.'
    if (q.validate && v) return q.validate(typeof v === 'string' ? v.trim() : v)
    return ''
  }

  const completedCount = steps.filter((step) => {
    const value = answers[step.id]
    return value !== undefined && value !== '' && value !== false && (!Array.isArray(value) || value.length > 0)
  }).length

  function goNext() {
    const message = validateStep()
    if (message) {
      setStepError(message)
      return
    }
    const backToReview = fromReview && !q.affectsFlow
    setFromReview(false)
    go(backToReview ? steps.length : index + 1)
  }

  function goBack() {
    setFromReview(false)
    go(inReview ? steps.length - 1 : index - 1)
  }

  function skip() {
    setFromReview(false)
    go(index + 1)
  }

  function jumpTo(id) {
    const target = steps.findIndex((s) => s.id === id)
    if (target === -1) return
    setFromReview(true)
    go(target)
  }

  async function handleSubmit() {
    setError('')
    if (consentQ && !answers[consentQ.id]) {
      setError('Please tick the box to confirm your answers.')
      return
    }
    setSaving(true)
    try {
      const visibleIds = new Set(allQuestions.map((s) => s.id))
      const clean = {}
      Object.entries(answers).forEach(([k, v]) => {
        const isOtherKey = allQuestions.some((s) => s.otherKey === k)
        if (!visibleIds.has(k) && !isOtherKey) return
        if (allQuestions.find((question) => question.id === k)?.type === 'phone' && v?.number) {
          clean[k] = `${v.country || ''} ${v.number.trim()}`.trim()
        } else {
          clean[k] = typeof v === 'string' ? v.trim() : v
        }
      })
      await onSubmit({ ...clean, ...lockedAnswers })
    } catch (err) {
      console.error(err)
      setError(
        err?.code === 'permission-denied'
          ? "You don't have permission to save this form. Please contact the practice."
          : 'Could not save your form. Please try again.',
      )
    }
    setSaving(false)
  }

  // ---- Intro ----
  if (!started) {
    return (
      <div className="min-h-screen bg-sand flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-2xl">
          <Card>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-11 h-11 rounded-2xl bg-blush/60 text-plum flex items-center justify-center">
                <ShieldCheck size={23} />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-rose">{intro.eyebrow}</p>
                <h1 className="text-2xl font-semibold text-ink">{intro.title}</h1>
              </div>
            </div>
            <p className="text-base text-ink mb-2">{intro.lead}</p>
            <p className="text-sm leading-6 text-slate mb-6">{intro.body}</p>
            <div className="grid sm:grid-cols-3 gap-3 mb-7">
              <div className="bg-mist rounded-xl p-3">
                <Clock3 size={17} className="text-rose mb-2" />
                <p className="text-xs font-medium text-ink">About 5 minutes</p>
                <p className="text-xs text-slate mt-1">Take your time</p>
              </div>
              <div className="bg-mist rounded-xl p-3">
                <LockKeyhole size={17} className="text-rose mb-2" />
                <p className="text-xs font-medium text-ink">Private by design</p>
                <p className="text-xs text-slate mt-1">{intro.privacy || 'Only you and the practice'}</p>
              </div>
              <div className="bg-mist rounded-xl p-3">
                <CheckCircle2 size={17} className="text-rose mb-2" />
                <p className="text-xs font-medium text-ink">Review before sending</p>
                <p className="text-xs text-slate mt-1">Nothing is submitted early</p>
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3">
              <button type="button" onClick={onLater} className={`${secondaryBtn} sm:w-auto`}>
                {intro.laterLabel || 'Do this later'}
              </button>
              <button type="button" onClick={() => setStarted(true)} className={`${primaryBtn} flex-1`}>
                {intro.startLabel || 'Start intake form'} <span aria-hidden="true">→</span>
              </button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // ---- Questions + review ----
  return (
    <div className="min-h-screen bg-sand flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose truncate">
              {inReview ? 'Final review' : q.section}
            </p>
            <p className="text-xs text-slate mt-1">
              {inReview ? 'Almost there' : `Question ${index + 1} of ${steps.length}`}
            </p>
          </div>
          <button type="button" onClick={onLater} className="text-xs text-slate hover:text-ink underline shrink-0">
            Finish later
          </button>
        </div>
        <div
          className="h-2 rounded-full bg-stone/40 mb-2 overflow-hidden"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-rose transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate mb-4">
          <span>{completedCount} answered</span>
          <span>{progress}% complete</span>
        </div>

        <Card className="shadow-md">
          {inReview ? (
            <>
              <h1 className="text-xl font-semibold text-ink mb-1">Check your answers</h1>
              <p className="text-sm leading-6 text-slate mb-5">
                Take a moment to check the details. You can change any answer before submitting the form to the practice.
              </p>
              <div className="mb-5">
                <IntakeSummary answers={answers} onChange={jumpTo} />
              </div>
              {consentQ && (
                <div className="mb-5">
                  <QuestionInput q={consentQ} answers={answers} setAnswer={setAnswer} onDirtyChange={setDirty} />
                </div>
              )}
              {error && <p role="alert" className="bg-pastel-red text-red text-sm rounded-xl px-4 py-3 mb-3">{error}</p>}
              <div className="flex items-center gap-3">
                <button type="button" onClick={goBack} disabled={saving} className={ghostBtn}>
                  <ArrowLeft size={16} className="inline -mt-0.5 mr-1" />
                  Back
                </button>
                <button type="button" onClick={handleSubmit} disabled={saving} className={`${primaryBtn} flex-1`}>
                  {saving ? 'Saving...' : 'Submit intake form'}
                </button>
              </div>
            </>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                goNext()
              }}
            >
              <h1 className="text-xl font-semibold text-ink mb-1">
                {q.label} {q.required && <span className="text-rose">*</span>}
              </h1>
              {q.help && <p className="text-sm text-slate mb-4">{q.help}</p>}
              {!q.help && <div className="mb-4" />}

              <QuestionInput
                q={q}
                answers={answers}
                setAnswer={setAnswer}
                onDirtyChange={setDirty}
              />

              {stepError && <p role="alert" className="bg-pastel-red text-red text-sm rounded-xl px-4 py-3 mt-3">{stepError}</p>}

              <div className="flex items-center gap-3 mt-6">
                {(index > 0 || fromReview) && (
                  <button type="button" onClick={goBack} className={ghostBtn}>
                    <ArrowLeft size={16} className="inline -mt-0.5 mr-1" />
                    Back
                  </button>
                )}
                <button type="submit" className={`${primaryBtn} flex-1`}>
                  {index === steps.length - 1 ? 'Review answers' : 'Continue'}
                </button>
                {!q.required && (
                  <button type="button" onClick={skip} className={ghostBtn}>
                    Skip
                  </button>
                )}
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
