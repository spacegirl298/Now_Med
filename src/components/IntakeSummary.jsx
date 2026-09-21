// Read-only view of an intake form's answers, grouped by section.
// Used in three places: the wizard's final review step (with `onChange` so
// each answer has a "Change" link), the patient's own Medical Records page,
// and the secretary's patient record. Hidden questions (e.g. medical aid
// number when the patient has no medical aid) are left out.
import { getVisibleQuestions, formatAnswer } from '../utils/intakeQuestions'

export default function IntakeSummary({ answers = {}, onChange }) {
  const questions = getVisibleQuestions(answers)
  const sections = []
  questions.forEach((q) => {
    if (q.type === 'consent') return
    let group = sections.find((s) => s.name === q.section)
    if (!group) {
      group = { name: q.section, items: [] }
      sections.push(group)
    }
    group.items.push(q)
  })

  return (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <div key={section.name} className="bg-mist rounded-xl p-4">
          <p className="text-sm font-semibold text-ink mb-3">{section.name}</p>
          <div className="flex flex-col gap-3">
            {section.items.map((q) => {
              const lines = formatAnswer(q, answers)
              return (
                <div key={q.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate">{q.label}</p>
                    {lines ? (
                      lines.map((line, i) => (
                        <p key={i} className="text-sm text-ink break-words">
                          {line}
                        </p>
                      ))
                    ) : (
                      <p className="text-sm text-slate italic">Not answered</p>
                    )}
                  </div>
                  {onChange && (
                    <button
                      type="button"
                      onClick={() => onChange(q.id)}
                      className="text-xs font-medium text-rose hover:underline shrink-0"
                    >
                      Change
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}