// Patient's own medical record (PRD: Medical Records - must-have).
// Mirrors PatientRecordModal's tabs and section styling so this feels like
// the same product as the secretary's full record view, but it's a page
// (not a modal) and almost everything here is read-only. Clinical data -
// allergies, medications, chronic conditions, surgical/admission history,
// family history, and consultation notes - is entered and verified by the
// practice, so patients can view it but not edit it here. The only fields a
// patient can change themselves are administrative/self-reported ones
// (occupation, marital status, emergency contact, medical aid details).
//
// Data is read live via subscribeToPatientProfile / subscribeToPatientRecords
// (rather than a one-time fetch), so a change either side makes - a
// secretary logging a new consultation, or the patient updating their
// emergency contact - shows up for the other within moments.
//
// Records tagged internalOnly by a secretary (staff notes not meant for the
// patient) are filtered out before anything ever reaches this screen.
//
// If this patient's history was originally logged as a walk-in (booked by
// phone/email/in person before they had an account), it was linked to their
// uid automatically at registration - see linkPatientDataByIdNumber in
// AuthContext - so it already shows up here with no extra work.
import { useEffect, useMemo, useState } from 'react'
import {
  FileText,
  HeartPulse,
  Pill,
  ShieldAlert,
  Stethoscope,
  Edit2,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useAppointments } from '../../hooks/useAppointments'
import {
  subscribeToPatientProfile,
  subscribeToPatientRecords,
  savePatientProfile,
} from '../../firebase/firestore'
import PatientLayout from './PatientLayout'
import BackButton from '../../components/BackButton'
import Card from '../../components/Card'
import Modal from '../../components/Modal'
import EmptyState from '../../components/EmptyState'
import { formatShortDate, getTodayString } from '../../utils/dateHelpers'
import { isValidPhone, isValidMedicalAidNumber } from '../../utils/validators'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'Medical History' },
  { id: 'allergies', label: 'Allergies' },
  { id: 'medications', label: 'Medications' },
  { id: 'visits', label: 'Visit History' },
]

const SEVERITY_BADGE = {
  Mild: 'bg-pastel-blue text-blue',
  Moderate: 'bg-pastel-amber text-amber',
  Severe: 'bg-pastel-red text-red',
}

const inputClasses =
  'w-full border border-stone rounded-lg px-3 py-2 text-sm text-ink bg-white focus:border-rose focus:outline-none'
const labelClasses = 'text-xs text-slate mb-1 block'

function calculateAge(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  if (isNaN(birth.getTime())) return null
  const diffMs = Date.now() - birth.getTime()
  const age = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25))
  return age >= 0 ? age : null
}

function SectionCard({ title, action, children }) {
  return (
    <div className="bg-mist rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {action}
      </div>
      {children}
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate">{label}</p>
      <p className="text-ink">{value ?? '-'}</p>
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

function Field({ label, children }) {
  return (
    <div>
      <label className={labelClasses}>{label}</label>
      {children}
    </div>
  )
}

export default function PatientRecords() {
  const { currentUser } = useAuth()
  const { appointments } = useAppointments()

  const [activeTab, setActiveTab] = useState('overview')

  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [records, setRecords] = useState([])
  const [loadingRecords, setLoadingRecords] = useState(true)
  // Surfaces a permission-denied / network error from either live
  // subscription. Without this, a blocked read just leaves the page on
  // "Loading your record..." forever with nothing but a console error to
  // explain why.
  const [loadError, setLoadError] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editError, setEditError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!currentUser) return
    setLoadError('')
    const unsubProfile = subscribeToPatientProfile(
      currentUser.uid,
      (p) => {
        setProfile(p)
        setLoadingProfile(false)
      },
      (err) => {
        console.error(err)
        setLoadError('Could not load your medical record. Please try again or contact the practice.')
        setLoadingProfile(false)
      },
    )
    // Staff-only entries are filtered out here, before they ever land in
    // this component's state - not just hidden in the UI.
    const unsubRecords = subscribeToPatientRecords(
      currentUser.uid,
      (list) => {
        setRecords(list.filter((r) => !r.internalOnly))
        setLoadingRecords(false)
      },
      (err) => {
        console.error(err)
        setLoadError('Could not load your medical record. Please try again or contact the practice.')
        setLoadingRecords(false)
      },
    )
    return () => {
      unsubProfile && unsubProfile()
      unsubRecords && unsubRecords()
    }
  }, [currentUser])

  const today = getTodayString()
  const myAppointments = useMemo(
    () => appointments.filter((a) => a.patientId === currentUser?.uid),
    [appointments, currentUser],
  )
  const nextAppointment = useMemo(
    () =>
      [...myAppointments]
        .filter((a) => a.date >= today && a.status !== 'cancelled')
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] || null,
    [myAppointments, today],
  )
  const lastVisit = useMemo(
    () =>
      [...myAppointments]
        .filter((a) => a.date < today)
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))[0] || null,
    [myAppointments, today],
  )

  const consultations = useMemo(
    () =>
      records
        .filter((r) => r.type === 'consultation')
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [records],
  )
  const quickNotes = useMemo(
    () =>
      records
        .filter((r) => r.type !== 'consultation')
        .sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [records],
  )
  const visitHistory = useMemo(
    () => [...consultations, ...quickNotes].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [consultations, quickNotes],
  )

  const age = calculateAge(profile?.dateOfBirth)

  function openEdit() {
    setEditForm({
      occupation: profile?.occupation || '',
      maritalStatus: profile?.maritalStatus || '',
      emergencyContactName: profile?.emergencyContactName || '',
      emergencyContactPhone: profile?.emergencyContactPhone || '',
      medicalAidProvider: profile?.medicalAidProvider || '',
      medicalAidNumber: profile?.medicalAidNumber || '',
    })
    setEditError('')
    setFieldErrors({})
    setEditOpen(true)
  }

  function setField(field, value) {
    setEditForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validateEditForm() {
    const errors = {}
    if (!isValidPhone(editForm.emergencyContactPhone)) {
      errors.emergencyContactPhone = 'Numbers only, 7–15 digits.'
    }
    if (!isValidMedicalAidNumber(editForm.medicalAidNumber)) {
      errors.medicalAidNumber = 'Numbers only.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function saveEdit() {
    setEditError('')
    if (!validateEditForm()) return
    setSaving(true)
    try {
      await savePatientProfile({
        profileId: profile?.id || null,
        patientId: currentUser.uid,
        ...editForm,
      })
      setEditOpen(false)
    } catch (err) {
      console.error(err)
      setEditError(
        err?.code === 'permission-denied'
          ? "You don't have permission to save these changes. Please contact the practice."
          : 'Could not save your changes. Please try again.',
      )
    }
    setSaving(false)
  }

  const loading = loadingProfile || loadingRecords

  return (
    <PatientLayout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <BackButton />
        <h1 className="text-2xl font-semibold text-ink mb-1">Medical records</h1>
        <p className="text-slate text-sm mb-6">
          Your health information on file with the practice. Clinical details are entered by your
          doctor's practice - contact them if anything needs correcting.
        </p>

        <div className="flex gap-2 mb-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'bg-rose text-white' : 'bg-mist text-slate hover:bg-sand'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loadError && (
          <div className="bg-pastel-red text-red text-sm rounded-xl px-4 py-3 mb-6">
            {loadError}
          </div>
        )}

        {loading ? (
          <p className="text-slate text-sm text-center py-16">Loading your record...</p>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="flex flex-col gap-6">
                <SectionCard
                  title="Personal information"
                  action={
                    <button
                      onClick={openEdit}
                      className="text-xs font-medium text-rose hover:underline flex items-center gap-1"
                    >
                      <Edit2 size={13} /> Edit contact details
                    </button>
                  }
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <InfoItem label="Date of birth" value={profile?.dateOfBirth ? formatShortDate(profile.dateOfBirth) : '-'} />
                    <InfoItem label="Age" value={age != null ? age : '-'} />
                    <InfoItem label="Gender" value={profile?.gender} />
                    <InfoItem label="Marital status" value={profile?.maritalStatus} />
                    <InfoItem label="Occupation" value={profile?.occupation} />
                    <InfoItem
                      label="Emergency contact"
                      value={
                        profile?.emergencyContactName
                          ? `${profile.emergencyContactName}${
                              profile.emergencyContactPhone ? ' · ' + profile.emergencyContactPhone : ''
                            }`
                          : '-'
                      }
                    />
                  </div>
                  <p className="text-xs text-slate mt-3">
                    Date of birth and gender are set by the practice. Everything else here you can
                    update yourself.
                  </p>
                </SectionCard>

                <SectionCard title="Quick medical snapshot">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                    <InfoItem label="Blood group" value={profile?.bloodGroup} />
                    <InfoItem label="Primary doctor" value={profile?.primaryDoctor} />
                    <InfoItem
                      label="Medical aid"
                      value={
                        profile?.medicalAidProvider
                          ? `${profile.medicalAidProvider}${
                              profile.medicalAidNumber ? ' · ' + profile.medicalAidNumber : ''
                            }`
                          : '-'
                      }
                    />
                    <InfoItem label="Last visit" value={lastVisit ? formatShortDate(lastVisit.date) : '-'} />
                    <InfoItem
                      label="Next appointment"
                      value={nextAppointment ? formatShortDate(nextAppointment.date) : '-'}
                    />
                    <InfoItem label="Chronic conditions" value={(profile?.chronicConditions || []).join(', ') || '-'} />
                  </div>
                </SectionCard>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="flex flex-col gap-6">
                <SectionCard title="Chronic conditions">
                  {(profile?.chronicConditions || []).length === 0 && !profile?.otherConditions ? (
                    <p className="text-sm text-slate">None on record.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(profile?.chronicConditions || []).map((c) => (
                        <Chip key={c} label={c} />
                      ))}
                      {profile?.otherConditions && <Chip label={profile.otherConditions} />}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="Previous surgeries">
                  {(profile?.previousSurgeries || []).length === 0 ? (
                    <p className="text-sm text-slate">None on record.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {profile.previousSurgeries.map((s, i) => (
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
                  {(profile?.hospitalAdmissions || []).length === 0 ? (
                    <p className="text-sm text-slate">None on record.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {profile.hospitalAdmissions.map((a, i) => (
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
                  {(profile?.familyHistory || []).length === 0 ? (
                    <p className="text-sm text-slate">None on record.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {profile.familyHistory.map((f) => (
                        <Chip key={f} label={f} />
                      ))}
                    </div>
                  )}
                </SectionCard>
              </div>
            )}

            {activeTab === 'allergies' && (
              <SectionCard title="Allergies">
                {(profile?.allergies || []).length === 0 ? (
                  <EmptyState icon={ShieldAlert} title="No known allergies" message="Nothing on file yet." />
                ) : (
                  <div className="flex flex-col gap-2">
                    {profile.allergies.map((a, i) => (
                      <div key={i} className="bg-white rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium text-ink">{a.allergen}</p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              SEVERITY_BADGE[a.severity] || 'bg-sand text-slate'
                            }`}
                          >
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
                {(profile?.currentMedications || []).length === 0 ? (
                  <EmptyState icon={Pill} title="No current medications" message="Nothing on file yet." />
                ) : (
                  <div className="flex flex-col gap-2">
                    {profile.currentMedications.map((m, i) => (
                      <div key={i} className="bg-white rounded-lg px-3 py-2">
                        <p className="text-sm font-medium text-ink">{m.name}</p>
                        <p className="text-xs text-slate">{[m.dosage, m.frequency].filter(Boolean).join(' · ')}</p>
                        {m.prescribingDoctor && (
                          <p className="text-xs text-slate">Prescribed by {m.prescribingDoctor}</p>
                        )}
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
                {visitHistory.length === 0 ? (
                  <EmptyState icon={FileText} title="No visits on record" message="Records added by the practice will show up here." />
                ) : (
                  <div className="flex flex-col gap-3">
                    {visitHistory.map((r) => (
                      <Card key={r.id}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-ink">{r.title}</p>
                          <p className="text-xs text-slate">{r.date ? formatShortDate(r.date) : ''}</p>
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
                            {r.notes && <p className="text-xs text-slate mt-1">{r.notes}</p>}
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
                          r.notes && <p className="text-sm text-ink mt-1">{r.notes}</p>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit the handful of admin/contact fields patients are allowed to
          change themselves. Clinical data has no edit path here on purpose. */}
      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit contact details"
        onConfirm={saveEdit}
        confirmLabel={saving ? 'Saving...' : 'Save'}
        confirmDisabled={saving}
      >
        <div className="grid grid-cols-1 gap-3">
          {editError && <p className="text-red text-xs">{editError}</p>}
          <Field label="Marital status">
            <input
              value={editForm.maritalStatus || ''}
              onChange={(e) => setField('maritalStatus', e.target.value)}
              className={inputClasses}
            />
          </Field>
          <Field label="Occupation">
            <input
              value={editForm.occupation || ''}
              onChange={(e) => setField('occupation', e.target.value)}
              className={inputClasses}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Emergency contact name">
              <input
                value={editForm.emergencyContactName || ''}
                onChange={(e) => setField('emergencyContactName', e.target.value)}
                className={inputClasses}
              />
            </Field>
            <Field label="Emergency contact phone">
              <input
                type="tel"
                inputMode="numeric"
                value={editForm.emergencyContactPhone || ''}
                onChange={(e) => setField('emergencyContactPhone', e.target.value)}
                className={`${inputClasses} ${fieldErrors.emergencyContactPhone ? 'border-red' : ''}`}
              />
              {fieldErrors.emergencyContactPhone && (
                <p className="text-red text-xs mt-1">{fieldErrors.emergencyContactPhone}</p>
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Medical aid provider">
              <input
                value={editForm.medicalAidProvider || ''}
                onChange={(e) => setField('medicalAidProvider', e.target.value)}
                className={inputClasses}
              />
            </Field>
            <Field label="Medical aid number">
              <input
                type="text"
                inputMode="numeric"
                value={editForm.medicalAidNumber || ''}
                onChange={(e) => setField('medicalAidNumber', e.target.value)}
                className={`${inputClasses} ${fieldErrors.medicalAidNumber ? 'border-red' : ''}`}
              />
              {fieldErrors.medicalAidNumber && (
                <p className="text-red text-xs mt-1">{fieldErrors.medicalAidNumber}</p>
              )}
            </Field>
          </div>
          <p className="text-xs text-slate">
            Need to correct your date of birth, gender, or clinical details? Contact the practice -
            those are managed on their side.
          </p>
        </div>
      </Modal>
    </PatientLayout>
  )
}