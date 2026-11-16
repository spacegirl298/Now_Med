import { FileText, HeartPulse, Pill, ShieldAlert, Stethoscope } from 'lucide-react'
import Card from '../Card'
import EmptyState from '../EmptyState'
import IntakeSummary from '../IntakeSummary'
import ChildHealthCard from './ChildHealthCard'
import {
  subscribeToPatientProfile,
  subscribeToPatientRecords,
  getIntakeForm,
} from '../../firebase/firestore'
import { formatAge } from '../../utils/childAge'
import { formatShortDate, formatDisplayDate, formatDate } from '../../utils/dateHelpers'
import { GENDER_OPTIONS } from '../../utils/validators'

const CLINICAL_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'Medical History' },
  { id: 'allergies', label: 'Allergies' },
  { id: 'medications', label: 'Medications' },
  { id: 'visits', label: 'Visit History' },
]
const INTAKE_TAB = { id: 'intake', label: 'Intake form' }

const SEVERITY_BADGE = {
  Mild: 'bg-pastel-blue text-blue',
  Moderate: 'bg-pastel-amber text-amber',
  Severe: 'bg-pastel-red text-red',
}

function tsToDisplay(ts) {
  const d = ts?.toDate ? ts.toDate() : null
  return d ? formatShortDate(formatDate(d)) : ''
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-mist rounded-xl p-4">
      <p className="text-sm font-semibold text-ink mb-3">{title}</p>
      {children}
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate">{label}</p>
      <p className="text-ink break-words">{value || '-'}</p>
    </div>
  )
}

function Chip({ label }) {
  return (
    <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-white text-slate border border-stone">
      {label}
    </span>
  )
}

export default function ChildRecordView({ child, clinicalVisible = true }) {
  const [tab, setTab] = useState(clinicalVisible ? 'overview' : 'intake')
  const [profile, setProfile] = useState(null)
  const [records, setRecords] = useState([])
  const [intake, setIntake] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(clinicalVisible)
  const [loadingRecords, setLoadingRecords] = useState(clinicalVisible)
  const [loadingIntake, setLoadingIntake] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!clinicalVisible) return
    const onError = (err) => {
      console.error(err)
      setLoadError("We couldn't load this record. Please try again or contact the practice.")
    }
    const unsubProfile = subscribeToPatientProfile(
      child.id,
      (p) => {
        setProfile(p)
        setLoadingProfile(false)
      },
      (err) => {
        onError(err)
        setLoadingProfile(false)
      },
    )
    const unsubRecords = subscribeToPatientRecords(
      child.id,
      (list) => {
        setRecords(list.filter((r) => !r.internalOnly))
        setLoadingRecords(false)
      },
      (err) => {
        onError(err)
        setLoadingRecords(false)
      },
    )
    return () => {
      unsubProfile && unsubProfile()
      unsubRecords && unsubRecords()
    }
  }, [child.id, clinicalVisible])

  useEffect(() => {
    let cancelled = false
    getIntakeForm(child.id)
      .then((form) => !cancelled && setIntake(form))
      .catch((err) => console.error('Could not load the intake form:', err))
      .finally(() => !cancelled && setLoadingIntake(false))
    return () => {
      cancelled = true
    }
  }, [child.id])

  const visits = useMemo(
    () => [...records].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [records],
  )
  const lastVisit = visits[0] || null

  const tabs = [
    ...(clinicalVisible ? CLINICAL_TABS : []),
    ...(intake ? [INTAKE_TAB] : []),
  ]
  const activeTab = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id

  const first = child.firstName || 'your child'
  const loading = clinicalVisible ? loadingProfile || loadingRecords : loadingIntake
  const answers = intake?.answers
  const gender = profile?.gender || answers?.gender
  const genderLabel = GENDER_OPTIONS.find((g) => g.value === gender)?.label || gender
  const history = (key) => profile?.[key] || []

  if (loading) {
    return <p className="text-sm text-slate text-center py-10">Loading record...</p>
  }

  if (tabs.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No intake form yet"
        message={`Once ${first}'s intake form is in, it will show here.`}
      />
    )
  }

  return (
    <div>
      {loadError && (
        <p role="alert" className="text-sm text-red bg-pastel-red rounded-xl px-4 py-3 mb-4">
          {loadError}
        </p>
      )}

      <div role="tablist" className="flex gap-2 mb-5 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === t.id ? 'bg-rose text-white' : 'bg-white text-slate hover:bg-mist'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="flex flex-col gap-5">
          {!profile && intake && (
            <p className="text-xs text-slate bg-white rounded-xl px-4 py-3">
              The practice has {first}'s intake form and will add it to this record once they have
              reviewed it. Your answers are under “Intake form”.
            </p>
          )}

          <SectionCard title="About">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <InfoItem label="Date of birth" value={child.dateOfBirth ? formatDisplayDate(child.dateOfBirth) : ''} />
              <InfoItem label="Age" value={child.dateOfBirth ? formatAge(child.dateOfBirth) : ''} />
              <InfoItem label="Gender" value={genderLabel} />
              <InfoItem label="Blood group" value={profile?.bloodGroup || answers?.bloodGroup} />
              <InfoItem label="Primary doctor" value={profile?.primaryDoctor} />
              <InfoItem label="Last visit" value={lastVisit?.date ? formatShortDate(lastVisit.date) : ''} />
              <InfoItem
                label="Medical aid"
                value={
                  profile?.medicalAidProvider
                    ? `${profile.medicalAidProvider}${profile.medicalAidNumber ? ' · ' + profile.medicalAidNumber : ''}`
                    : ''
                }
              />
              <InfoItem
                label="Emergency contact"
                value={
                  profile?.emergencyContactName
                    ? `${profile.emergencyContactName}${profile.emergencyContactPhone ? ' · ' + profile.emergencyContactPhone : ''}`
                    : ''
                }
              />
            </div>
          </SectionCard>

          <SectionCard title="Quick medical snapshot">
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <p className="text-xs text-slate mb-1">Chronic conditions</p>
                {history('chronicConditions').length === 0 && !profile?.otherConditions ? (
                  <p className="text-ink">None on record</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {history('chronicConditions').map((c) => <Chip key={c} label={c} />)}
                    {profile?.otherConditions && <Chip label={profile.otherConditions} />}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-slate mb-1">Allergies</p>
                {history('allergies').length === 0 ? (
                  <p className="text-ink">None on record</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {history('allergies').map((a, i) => (
                      <span
                        key={i}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${SEVERITY_BADGE[a.severity] || 'bg-sand text-slate'}`}
                      >
                        {a.allergen}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-slate mb-1">Current medications</p>
                <p className="text-ink">
                  {history('currentMedications').map((m) => m.name).filter(Boolean).join(', ') || 'None on record'}
                </p>
              </div>
            </div>
          </SectionCard>

          <ChildHealthCard answers={answers} />
        </div>
      )}

      {activeTab === 'history' && (
        <div className="flex flex-col gap-5">
          <SectionCard title="Previous surgeries">
            {history('previousSurgeries').length === 0 ? (
              <p className="text-sm text-slate">None on record.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {history('previousSurgeries').map((s, i) => (
                  <div key={i} className="bg-white rounded-lg px-3 py-2">
                    <p className="text-sm text-ink">{s.procedure}</p>
                    <p className="text-xs text-slate">
                      {[s.hospital, s.date ? formatShortDate(s.date) : ''].filter(Boolean).join(' · ')}
                    </p>
                    {s.notes && <p className="text-xs text-slate mt-0.5">{s.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Hospital admissions">
            {history('hospitalAdmissions').length === 0 ? (
              <p className="text-sm text-slate">None on record.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {history('hospitalAdmissions').map((a, i) => (
                  <div key={i} className="bg-white rounded-lg px-3 py-2">
                    <p className="text-sm text-ink">{a.hospital}</p>
                    <p className="text-xs text-slate">
                      {a.admissionDate ? formatShortDate(a.admissionDate) : '?'} –{' '}
                      {a.dischargeDate ? formatShortDate(a.dischargeDate) : 'ongoing'}
                    </p>
                    {a.reason && <p className="text-xs text-slate mt-0.5">{a.reason}</p>}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Family history">
            {history('familyHistory').length === 0 ? (
              <p className="text-sm text-slate">None on record.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {history('familyHistory').map((f) => <Chip key={f} label={f} />)}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {activeTab === 'allergies' && (
        <SectionCard title="Allergies">
          {history('allergies').length === 0 ? (
            <EmptyState icon={ShieldAlert} title="No known allergies" message="Nothing on file yet." />
          ) : (
            <div className="flex flex-col gap-2">
              {history('allergies').map((a, i) => (
                <div key={i} className="bg-white rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-ink">{a.allergen}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_BADGE[a.severity] || 'bg-sand text-slate'}`}>
                      {a.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate">{[a.type, a.reaction].filter(Boolean).join(' · ')}</p>
                  {a.notes && <p className="text-xs text-slate mt-0.5">{a.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === 'medications' && (
        <SectionCard title="Current medications">
          {history('currentMedications').length === 0 ? (
            <EmptyState icon={Pill} title="No current medications" message="Nothing on file yet." />
          ) : (
            <div className="flex flex-col gap-2">
              {history('currentMedications').map((m, i) => (
                <div key={i} className="bg-white rounded-lg px-3 py-2">
                  <p className="text-sm font-medium text-ink">{m.name}</p>
                  <p className="text-xs text-slate">{[m.dosage, m.frequency].filter(Boolean).join(' · ')}</p>
                  {m.prescribingDoctor && <p className="text-xs text-slate">Prescribed by {m.prescribingDoctor}</p>}
                  {m.notes && <p className="text-xs text-slate mt-0.5">{m.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {activeTab === 'visits' && (
        <div>
          <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2 flex items-center gap-2">
            <Stethoscope size={14} /> Visit history
          </p>
          {visits.length === 0 ? (
            <EmptyState icon={FileText} title="No visits on record" message={`Records from ${first}'s visits will show up here.`} />
          ) : (
            <div className="flex flex-col gap-3">
              {visits.map((r) => (
                <Card key={r.id}>
                  <div className="flex items-center justify-between mb-1 gap-3">
                    <p className="text-sm font-medium text-ink">{r.title || 'Visit note'}</p>
                    <p className="text-xs text-slate shrink-0">{r.date ? formatShortDate(r.date) : ''}</p>
                  </div>
                  {r.type === 'consultation' ? (
                    <>
                      {r.doctor && <p className="text-xs text-slate">Seen by {r.doctor}</p>}
                      {r.diagnosis && <p className="text-sm text-ink mt-1">Diagnosis: {r.diagnosis}</p>}
                      {r.treatment && <p className="text-sm text-ink">Treatment: {r.treatment}</p>}
                      {r.followUpRequired && (
                        <p className="text-xs text-amber mt-1 flex items-center gap-1">
                          <HeartPulse size={12} /> Follow-up required
                        </p>
                      )}
                      {r.notes && <p className="text-xs text-slate mt-1 whitespace-pre-wrap break-words">{r.notes}</p>}
                      {r.vitals && (
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-2 mt-2 text-xs text-slate">
                          {r.vitals.height && <span>Height: {r.vitals.height}cm</span>}
                          {r.vitals.weight && <span>Weight: {r.vitals.weight}kg</span>}
                          {r.vitals.bmi && <span>BMI: {r.vitals.bmi}</span>}
                          {r.vitals.bloodPressure && <span>BP: {r.vitals.bloodPressure}</span>}
                          {r.vitals.pulse && <span>Pulse: {r.vitals.pulse}</span>}
                          {r.vitals.temperature && <span>Temp: {r.vitals.temperature}°C</span>}
                          {r.vitals.oxygenSaturation && <span>O2: {r.vitals.oxygenSaturation}%</span>}
                          {r.vitals.bloodSugar && <span>Blood sugar: {r.vitals.bloodSugar}</span>}
                        </div>
                      )}
                    </>
                  ) : (
                    r.notes && <p className="text-sm text-ink mt-1 whitespace-pre-wrap break-words">{r.notes}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'intake' && intake && (
        <div className="flex flex-col gap-4">
          <p className="text-xs text-slate">
            Submitted {intake.submittedBy === 'secretary' ? 'by the practice' : 'by you'} on{' '}
            {tsToDisplay(intake.submittedAt) || '-'}. To correct something, message the practice.
          </p>
          <IntakeSummary answers={intake.answers} />
        </div>
      )}
    </div>
  )
}
