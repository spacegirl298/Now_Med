// Birth, vaccination and development answers from a child's intake form.
// These have no field on the clinical profile (they are child-only), so this
// card is how they reach a record: on the parent's Records tab and on the
// secretary's child overview. Renders nothing for a form that has none.
const wrap = 'bg-mist rounded-xl p-4'

export default function ChildHealthCard({ answers }) {
  if (!answers) return null

  const rows = [
    ['Born', answers.birthHistory],
    ['Birth weight', answers.birthWeight],
    ['Vaccinations', answers.immunisations],
    ['School or creche', answers.schoolOrCreche],
  ].filter(([, value]) => value)
  const concerns = (answers.developmentConcerns || '').trim()

  if (rows.length === 0 && !concerns) return null

  return (
    <div className={wrap}>
      <p className="text-sm font-semibold text-ink mb-3">Birth and development</p>
      {rows.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-slate">{label}</p>
              <p className="text-ink">{value}</p>
            </div>
          ))}
        </div>
      )}
      {concerns && (
        <div className={rows.length > 0 ? 'mt-3' : ''}>
          <p className="text-xs text-slate">Concerns about growth, development or behaviour</p>
          <p className="text-sm text-ink whitespace-pre-wrap break-words">{concerns}</p>
        </div>
      )}
    </div>
  )
}
