// First-Time Patient Intake Form (PRD: must-have).
//
// A one-question-at-a-time wizard, so a long medical history doesn't feel
// like a wall of fields. Flow:
//   1. On first login AuthContext checks whether an intake form already
//      exists for this patient (by uid or ID number). If not, RequireIntake
//      (App.jsx) sends them here.
//   2. "Do this later" is available on every screen. It marks the prompt as
//      seen (deferIntake) and drops them on the dashboard, where a floating
//      form button (IntakeFormButton) brings them back until it's finished.
//   3. On submit the full answers are saved to `intakeForms` (visible to the
//      secretary on the patient's record) and the six non-clinical fields
//      patients are allowed to write are also copied onto their profile.
//      Clinical answers are NOT written to patientProfiles - patients can't
//      edit those; a secretary reviews and imports them.
//
// Answers live in memory only. If the patient picks "Do this later" halfway
// through, partial answers are not kept (medical data isn't parked in
// browser storage).
import { useMemo, useState, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  saveIntakeForm,
  savePatientProfile,
  getPatientProfile,
  getIntakeFormForPatient,
} from '../../firebase/firestore'
import Card from '../../components/Card'
import IntakeSummary from '../../components/IntakeSummary'
import {
  getVisibleQuestions,
  PROFILE_SYNC_FIELDS,
} from '../../utils/intakeQuestions'

const inputClasses =
  'w-full border border-stone rounded-xl px-4 py-3 text-ink bg-white focus:border-rose focus:outline-none'
const primaryBtn =
  'bg-rose text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-plum transition-colors disabled:opacity-60'
const ghostBtn = 'text-sm text-slate hover:text-ink px-2 py-2'

function chipClasses(selected) {
  return `px-4 py-2.5 rounded-full text-sm font-medium border transition-colors ${
    selected
      ? 'bg-rose text-white border-rose'
      : 'bg-white text-ink border-stone hover:border-rose'
  }`
}

// ---------- Input for a repeatable list (allergies, medication, ...) ----------

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
    // Enter inside the add-entry fields adds the entry rather than
    // submitting the whole step.
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

// ---------- Page ----------

export default function PatientIntake() {
  const { currentUser, userName, userIdNumber, intakeCompleted, completeIntake, deferIntake } =
    useAuth()
  const navigate = useNavigate()

  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState({})
  const [index, setIndex] = useState(0)
  const [stepError, setStepError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [fromReview, setFromReview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // The consent checkbox is asked on the review screen (after the patient
  // has seen their answers), not as a numbered question.
  const allQuestions = useMemo(() => getVisibleQuestions(answers), [answers])
  const steps = useMemo(() => allQuestions.filter((x) => x.type !== 'consent'), [allQuestions])
  const consentQ = allQuestions.find((x) => x.type === 'consent')
  const inReview = index >= steps.length
  const q = steps[index]
  const progress = Math.round((Math.min(index, steps.length) / steps.length) * 100)

  // Already done (e.g. deep-linked back here) - nothing to fill in.
  if (intakeCompleted) return <Navigate to="/patient/dashboard" replace />

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
    const empty = v === undefined || v === '' || v === false || (Array.isArray(v) && v.length === 0)
    if (q.required && empty) return 'This question is required.'
    if (q.validate && v) return q.validate(typeof v === 'string' ? v.trim() : v)
    return ''
  }

  function goNext() {
    const message = validateStep()
    if (message) {
      setStepError(message)
      return
    }
    // Coming from "Change" on the review screen: go straight back, unless
    // the answer changes which questions appear (e.g. medical aid yes/no).
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

  async function handleLater() {
    await deferIntake()
    navigate('/patient/dashboard')
  }

  async function handleSubmit() {
    setError('')
    if (consentQ && !answers[consentQ.id]) {
      setError('Please tick the box to confirm your answers.')
      return
    }
    setSaving(true)
    try {
      // Trim free text and drop answers for questions that ended up hidden.
      const visibleIds = new Set(allQuestions.map((s) => s.id))
      const clean = {}
      Object.entries(answers).forEach(([k, v]) => {
        const isOtherKey = allQuestions.some((s) => s.otherKey === k)
        if (!visibleIds.has(k) && !isOtherKey) return
        clean[k] = typeof v === 'string' ? v.trim() : v
      })

      // Guard against a double submit (or a form linked by ID number since
      // this page loaded).
      const existing = await getIntakeFormForPatient(currentUser.uid, userIdNumber)
      if (!existing) {
        await saveIntakeForm({
          patientId: currentUser.uid,
          patientIdNumber: userIdNumber,
          answers: clean,
          submittedBy: 'patient',
        })
      }

      // Copy the non-clinical fields patients may write onto their profile.
      // Only non-empty answers, so we never blank out something a secretary
      // already entered for a walk-in. A failure here must not lose the form.
      const profileFields = {}
      PROFILE_SYNC_FIELDS.forEach((k) => {
        if (clean[k]) profileFields[k] = clean[k]
      })
      if (Object.keys(profileFields).length > 0) {
        try {
          const profile = await getPatientProfile(currentUser.uid)
          await savePatientProfile({
            profileId: profile?.id || null,
            patientId: currentUser.uid,
            patientIdNumber: userIdNumber,
            ...profileFields,
          })
        } catch (err) {
          console.error('Intake saved, but profile fields could not be copied:', err)
        }
      }

      await completeIntake()
      navigate('/patient/dashboard')
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
      <div className="min-h-screen bg-mist flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          <Card>
            <h1 className="text-2xl font-semibold text-ink mb-2">
              Welcome{userName ? `, ${userName}` : ''}!
            </h1>
            <p className="text-sm text-slate mb-2">
              Before your first visit, we'd like to get to know you a little.
              We'll ask one question at a time about your details and your
              health, and you can skip anything you're not sure about.
            </p>
            <p className="text-sm text-slate mb-6">
              It takes about five minutes. Your answers go into your medical
              record, where only you and the practice can see them.
            </p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setStarted(true)} className={`${primaryBtn} flex-1`}>
                Start
              </button>
              <button type="button" onClick={handleLater} className="text-sm text-slate underline px-2">
                Do this later
              </button>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  // ---- Questions + review ----
  return (
    <div className="min-h-screen bg-mist flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate">
            {inReview ? 'Review' : `${q.section} · Question ${index + 1} of ${steps.length}`}
          </p>
          <button type="button" onClick={handleLater} className="text-xs text-slate underline">
            Do this later
          </button>
        </div>
        <div
          className="h-1.5 rounded-full bg-stone/40 mb-4 overflow-hidden"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full bg-rose transition-all" style={{ width: `${progress}%` }} />
        </div>

        <Card>
          {inReview ? (
            <>
              <h1 className="text-xl font-semibold text-ink mb-1">Check your answers</h1>
              <p className="text-sm text-slate mb-5">
                Use “Change” on anything that needs fixing, then submit.
              </p>
              <div className="mb-5">
                <IntakeSummary answers={answers} onChange={jumpTo} />
              </div>
              {consentQ && (
                <div className="mb-5">
                  <QuestionInput q={consentQ} answers={answers} setAnswer={setAnswer} onDirtyChange={setDirty} />
                </div>
              )}
              {error && <p className="text-sm text-red mb-3">{error}</p>}
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
              <h1 className="text-xl font-semibold text-ink mb-1">{q.label}</h1>
              {q.help && <p className="text-sm text-slate mb-4">{q.help}</p>}
              {!q.help && <div className="mb-4" />}

              <QuestionInput
                q={q}
                answers={answers}
                setAnswer={setAnswer}
                onDirtyChange={setDirty}
              />

              {stepError && <p className="text-sm text-red mt-3">{stepError}</p>}

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