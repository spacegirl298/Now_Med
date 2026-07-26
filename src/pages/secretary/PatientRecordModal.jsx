// Full clinical record for one patient, opened from the "View full record"
// button on the quick overview popup (see PatientList.jsx). Tabbed so a long
// history doesn't turn into one giant scroll. Every section here is editable
// by the secretary — clinical data entered from paper forms or after a
// consultation, not just viewed.
import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  getPatientProfile,
  getPatientProfileByIdNumber,
  savePatientProfile,
  getPatientRecords,
  getRecordsByIdNumber,
  addPatientRecord,
} from '../../firebase/firestore'
import { formatShortDate, formatDisplayDate, getTodayString } from '../../utils/dateHelpers'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'history', label: 'Medical History' },
  { id: 'allergies', label: 'Allergies' },
  { id: 'medications', label: 'Medications' },
  { id: 'consultations', label: 'Consultations' },
]

const CHRONIC_CONDITIONS = ['Diabetes', 'Hypertension', 'Asthma', 'Heart Disease', 'Epilepsy', 'Mental Health Conditions']
const FAMILY_HISTORY_OPTIONS = ['Diabetes', 'Cancer', 'Stroke', 'Heart Disease', 'High Blood Pressure', 'Mental Illness']
const ALLERGY_TYPES = ['Medication', 'Food', 'Environmental']
const SEVERITIES = ['Mild', 'Moderate', 'Severe']
const SEVERITY_BADGE = { Mild: 'bg-pastel-blue text-blue', Moderate: 'bg-pastel-amber text-amber', Severe: 'bg-pastel-red text-red' }

function calculateAge(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  if (isNaN(birth.getTime())) return null
  const diffMs = Date.now() - birth.getTime()
  const age = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 365.25))
  return age >= 0 ? age : null
}

function calculateBmi(heightCm, weightKg) {
  const h = parseFloat(heightCm)
  const w = parseFloat(weightKg)
  if (!h || !w) return ''
  const m = h / 100
  return (w / (m * m)).toFixed(1)
}

const inputClasses = 'w-full border border-stone rounded-lg px-3 py-2 text-sm text-ink bg-white focus:border-rose focus:outline-none'
const labelClasses = 'text-xs text-slate mb-1 block'

function Field({ label, children }) {
  return (
    <div>
      <label className={labelClasses}>{label}</label>
      {children}
    </div>
  )
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

export default function PatientRecordModal({ patient, appointments = [], initialTab = 'overview', autoOpenAddForm = false, onClose }) {
  const { currentUser } = useAuth()
  const [activeTab, setActiveTab] = useState(initialTab)

  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [records, setRecords] = useState([])
  const [loadingRecords, setLoadingRecords] = useState(true)

  const [editingOverview, setEditingOverview] = useState(false)
  const [overviewForm, setOverviewForm] = useState({})
  const [showConsultForm, setShowConsultForm] = useState(autoOpenAddForm)
  const [savingConsult, setSavingConsult] = useState(false)
  const [consultError, setConsultError] = useState('')

  const patientKey = patient?.id || patient?.idNumber

  useEffect(() => {
    if (!patient) return
    setLoadingProfile(true)
    const profilePromise = patient.id ? getPatientProfile(patient.id) : getPatientProfileByIdNumber(patient.idNumber)
    profilePromise
      .then((p) => {
        setProfile(p)
        setOverviewForm(p || {})
      })
      .catch(() => setProfile(null))
      .finally(() => setLoadingProfile(false))

    setLoadingRecords(true)
    const recordsPromise = patient.id ? getPatientRecords(patient.id) : getRecordsByIdNumber(patient.idNumber)
    recordsPromise
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setLoadingRecords(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientKey])

  async function persistProfile(updates) {
    const id = await savePatientProfile({
      profileId: profile?.id || null,
      patientId: patient.id || null,
      patientIdNumber: patient.idNumber || '',
      ...updates,
    })
    setProfile((prev) => ({ id, ...(prev || {}), ...updates }))
  }

  const today = getTodayString()
  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => a.date >= today && a.status !== 'cancelled')
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [appointments, today],
  )
  const past = useMemo(
    () =>
      appointments
        .filter((a) => a.date < today)
        .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    [appointments, today],
  )
  const nextAppointment = upcoming[0] || null
  const lastVisit = past[0] || null

  function toggleTag(field, value) {
    const current = profile?.[field] || []
    const next = current.includes(value) ? current.filter((c) => c !== value) : [...current, value]
    persistProfile({ [field]: next })
  }

  const consultations = useMemo(
    () => records.filter((r) => r.type === 'consultation').sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [records],
  )
  const quickNotes = useMemo(
    () => records.filter((r) => r.type !== 'consultation').sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [records],
  )

  if (!patient) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sand shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-ink">{patient.name || 'Unnamed patient'}</h2>
            <p className="text-xs text-slate">Full patient record</p>
          </div>
          <button onClick={onClose} className="text-slate hover:text-ink" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 px-6 py-3 border-b border-sand overflow-x-auto shrink-0">
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

        <div className="px-6 py-5 overflow-y-auto grow">
          {loadingProfile ? (
            <p className="text-sm text-slate text-center py-10">Loading record...</p>
          ) : (
            <>
              {activeTab === 'overview' && (
                <OverviewTab
                  patient={patient}
                  profile={profile}
                  editingOverview={editingOverview}
                  setEditingOverview={setEditingOverview}
                  overviewForm={overviewForm}
                  setOverviewForm={setOverviewForm}
                  onSave={async () => {
                    await persistProfile(overviewForm)
                    setEditingOverview(false)
                  }}
                  nextAppointment={nextAppointment}
                  lastVisit={lastVisit}
                />
              )}

              {activeTab === 'history' && (
                <MedicalHistoryTab profile={profile} onToggleTag={toggleTag} onPersist={persistProfile} />
              )}

              {activeTab === 'allergies' && <AllergiesTab profile={profile} onPersist={persistProfile} />}

              {activeTab === 'medications' && <MedicationsTab profile={profile} onPersist={persistProfile} />}

              {activeTab === 'consultations' && (
                <ConsultationsTab
                  patient={patient}
                  currentUser={currentUser}
                  consultations={consultations}
                  quickNotes={quickNotes}
                  loading={loadingRecords}
                  showForm={showConsultForm}
                  setShowForm={setShowConsultForm}
                  saving={savingConsult}
                  setSaving={setSavingConsult}
                  error={consultError}
                  setError={setConsultError}
                  onAdded={(entry) => setRecords((prev) => [entry, ...prev])}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------- Overview ----------------

function OverviewTab({ patient, profile, editingOverview, setEditingOverview, overviewForm, setOverviewForm, onSave, nextAppointment, lastVisit }) {
  const age = calculateAge(overviewForm.dateOfBirth || profile?.dateOfBirth)

  function set(field, value) {
    setOverviewForm((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Personal information"
        action={
          !editingOverview ? (
            <button onClick={() => setEditingOverview(true)} className="text-xs font-medium text-rose hover:underline">
              Edit
            </button>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => setEditingOverview(false)} className="text-xs font-medium text-slate hover:underline">
                Cancel
              </button>
              <button onClick={onSave} className="text-xs font-medium text-rose hover:underline">
                Save
              </button>
            </div>
          )
        }
      >
        {!editingOverview ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <InfoItem label="Full name" value={patient.name} />
            <InfoItem label="Date of birth" value={profile?.dateOfBirth ? formatDisplayDate(profile.dateOfBirth) : '—'} />
            <InfoItem label="Age" value={age != null ? age : '—'} />
            <InfoItem label="Gender" value={profile?.gender || '—'} />
            <InfoItem label="ID/Passport number" value={patient.idNumber || '—'} />
            <InfoItem label="Contact number" value={patient.phone || '—'} />
            <InfoItem label="Email address" value={patient.email || '—'} />
            <InfoItem label="Marital status" value={profile?.maritalStatus || '—'} />
            <InfoItem label="Occupation" value={profile?.occupation || '—'} />
            <InfoItem label="Emergency contact" value={profile?.emergencyContactName ? `${profile.emergencyContactName}${profile.emergencyContactPhone ? ' · ' + profile.emergencyContactPhone : ''}` : '—'} />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of birth">
              <input type="date" value={overviewForm.dateOfBirth || ''} onChange={(e) => set('dateOfBirth', e.target.value)} className={inputClasses} />
            </Field>
            <Field label="Gender">
              <input value={overviewForm.gender || ''} onChange={(e) => set('gender', e.target.value)} className={inputClasses} />
            </Field>
            <Field label="Marital status">
              <input value={overviewForm.maritalStatus || ''} onChange={(e) => set('maritalStatus', e.target.value)} className={inputClasses} />
            </Field>
            <Field label="Occupation">
              <input value={overviewForm.occupation || ''} onChange={(e) => set('occupation', e.target.value)} className={inputClasses} />
            </Field>
            <Field label="Emergency contact name">
              <input value={overviewForm.emergencyContactName || ''} onChange={(e) => set('emergencyContactName', e.target.value)} className={inputClasses} />
            </Field>
            <Field label="Emergency contact phone">
              <input value={overviewForm.emergencyContactPhone || ''} onChange={(e) => set('emergencyContactPhone', e.target.value)} className={inputClasses} />
            </Field>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Quick medical snapshot">
        {!editingOverview ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <InfoItem label="Blood group" value={profile?.bloodGroup || '—'} />
            <InfoItem label="Primary doctor" value={profile?.primaryDoctor || '—'} />
            <InfoItem label="Medical aid" value={profile?.medicalAidProvider ? `${profile.medicalAidProvider}${profile.medicalAidNumber ? ' · ' + profile.medicalAidNumber : ''}` : '—'} />
            <InfoItem label="Last visit" value={lastVisit ? formatShortDate(lastVisit.date) : '—'} />
            <InfoItem label="Next appointment" value={nextAppointment ? formatShortDate(nextAppointment.date) : '—'} />
            <InfoItem label="Chronic conditions" value={(profile?.chronicConditions || []).join(', ') || '—'} />
            <div className="col-span-2 md:col-span-3">
              <p className="text-xs text-slate mb-1">Allergies</p>
              {(profile?.allergies || []).length === 0 ? (
                <p className="text-ink text-sm">—</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {profile.allergies.map((a, i) => (
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
            <div className="col-span-2 md:col-span-3">
              <p className="text-xs text-slate mb-1">Current medications</p>
              <p className="text-ink text-sm">
                {(profile?.currentMedications || []).length === 0
                  ? '—'
                  : profile.currentMedications.map((m) => m.name).filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Blood group">
              <input value={overviewForm.bloodGroup || ''} onChange={(e) => set('bloodGroup', e.target.value)} className={inputClasses} placeholder="e.g. O+" />
            </Field>
            <Field label="Primary doctor">
              <input value={overviewForm.primaryDoctor || ''} onChange={(e) => set('primaryDoctor', e.target.value)} className={inputClasses} />
            </Field>
            <Field label="Medical aid provider">
              <input value={overviewForm.medicalAidProvider || ''} onChange={(e) => set('medicalAidProvider', e.target.value)} className={inputClasses} />
            </Field>
            <Field label="Medical aid number">
              <input value={overviewForm.medicalAidNumber || ''} onChange={(e) => set('medicalAidNumber', e.target.value)} className={inputClasses} />
            </Field>
          </div>
        )}
        <p className="text-xs text-slate mt-3">Allergies, conditions and medications are managed from their own tabs.</p>
      </SectionCard>
    </div>
  )
}

function InfoItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate">{label}</p>
      <p className="text-ink">{value}</p>
    </div>
  )
}

// ---------------- Medical History ----------------

function MedicalHistoryTab({ profile, onToggleTag, onPersist }) {
  const [surgeryForm, setSurgeryForm] = useState({ procedure: '', hospital: '', date: '', notes: '' })
  const [showSurgeryForm, setShowSurgeryForm] = useState(false)
  const [admissionForm, setAdmissionForm] = useState({ hospital: '', admissionDate: '', dischargeDate: '', reason: '' })
  const [showAdmissionForm, setShowAdmissionForm] = useState(false)
  const [otherCondition, setOtherCondition] = useState(profile?.otherConditions || '')

  const surgeries = profile?.previousSurgeries || []
  const admissions = profile?.hospitalAdmissions || []

  async function addSurgery() {
    if (!surgeryForm.procedure.trim()) return
    await onPersist({ previousSurgeries: [...surgeries, surgeryForm] })
    setSurgeryForm({ procedure: '', hospital: '', date: '', notes: '' })
    setShowSurgeryForm(false)
  }

  async function removeSurgery(index) {
    await onPersist({ previousSurgeries: surgeries.filter((_, i) => i !== index) })
  }

  async function addAdmission() {
    if (!admissionForm.hospital.trim()) return
    await onPersist({ hospitalAdmissions: [...admissions, admissionForm] })
    setAdmissionForm({ hospital: '', admissionDate: '', dischargeDate: '', reason: '' })
    setShowAdmissionForm(false)
  }

  async function removeAdmission(index) {
    await onPersist({ hospitalAdmissions: admissions.filter((_, i) => i !== index) })
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Chronic conditions">
        <div className="flex flex-wrap gap-2 mb-3">
          {CHRONIC_CONDITIONS.map((c) => (
            <ChipToggle key={c} label={c} active={(profile?.chronicConditions || []).includes(c)} onClick={() => onToggleTag('chronicConditions', c)} />
          ))}
        </div>
        <Field label="Other conditions">
          <input
            value={otherCondition}
            onChange={(e) => setOtherCondition(e.target.value)}
            onBlur={() => onPersist({ otherConditions: otherCondition })}
            className={inputClasses}
            placeholder="Anything not listed above"
          />
        </Field>
      </SectionCard>

      <SectionCard
        title="Previous surgeries"
        action={
          <button onClick={() => setShowSurgeryForm((v) => !v)} className="text-xs font-medium text-rose hover:underline flex items-center gap-1">
            <Plus size={13} /> Add
          </button>
        }
      >
        {showSurgeryForm && (
          <div className="bg-white rounded-lg p-3 mb-3 flex flex-col gap-2 border border-sand">
            <input value={surgeryForm.procedure} onChange={(e) => setSurgeryForm({ ...surgeryForm, procedure: e.target.value })} placeholder="Procedure" className={inputClasses} />
            <input value={surgeryForm.hospital} onChange={(e) => setSurgeryForm({ ...surgeryForm, hospital: e.target.value })} placeholder="Hospital" className={inputClasses} />
            <input type="date" value={surgeryForm.date} onChange={(e) => setSurgeryForm({ ...surgeryForm, date: e.target.value })} className={inputClasses} />
            <textarea value={surgeryForm.notes} onChange={(e) => setSurgeryForm({ ...surgeryForm, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className={inputClasses} />
            <button onClick={addSurgery} className="self-start bg-rose text-white rounded-lg px-4 py-2 text-xs font-medium hover:bg-plum transition-colors">
              Save surgery
            </button>
          </div>
        )}
        {surgeries.length === 0 ? (
          <p className="text-sm text-slate">None on record.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {surgeries.map((s, i) => (
              <div key={i} className="bg-white rounded-lg px-3 py-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-ink">{s.procedure}</p>
                  <p className="text-xs text-slate">
                    {[s.hospital, s.date ? formatShortDate(s.date) : ''].filter(Boolean).join(' · ')}
                  </p>
                  {s.notes && <p className="text-xs text-slate mt-0.5">{s.notes}</p>}
                </div>
                <button onClick={() => removeSurgery(i)} className="text-slate hover:text-red shrink-0" aria-label="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Hospital admissions"
        action={
          <button onClick={() => setShowAdmissionForm((v) => !v)} className="text-xs font-medium text-rose hover:underline flex items-center gap-1">
            <Plus size={13} /> Add
          </button>
        }
      >
        {showAdmissionForm && (
          <div className="bg-white rounded-lg p-3 mb-3 flex flex-col gap-2 border border-sand">
            <input value={admissionForm.hospital} onChange={(e) => setAdmissionForm({ ...admissionForm, hospital: e.target.value })} placeholder="Hospital" className={inputClasses} />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={admissionForm.admissionDate} onChange={(e) => setAdmissionForm({ ...admissionForm, admissionDate: e.target.value })} className={inputClasses} />
              <input type="date" value={admissionForm.dischargeDate} onChange={(e) => setAdmissionForm({ ...admissionForm, dischargeDate: e.target.value })} className={inputClasses} />
            </div>
            <input value={admissionForm.reason} onChange={(e) => setAdmissionForm({ ...admissionForm, reason: e.target.value })} placeholder="Reason" className={inputClasses} />
            <button onClick={addAdmission} className="self-start bg-rose text-white rounded-lg px-4 py-2 text-xs font-medium hover:bg-plum transition-colors">
              Save admission
            </button>
          </div>
        )}
        {admissions.length === 0 ? (
          <p className="text-sm text-slate">None on record.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {admissions.map((a, i) => (
              <div key={i} className="bg-white rounded-lg px-3 py-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-ink">{a.hospital}</p>
                  <p className="text-xs text-slate">
                    {a.admissionDate ? formatShortDate(a.admissionDate) : '?'} – {a.dischargeDate ? formatShortDate(a.dischargeDate) : 'ongoing'}
                  </p>
                  {a.reason && <p className="text-xs text-slate mt-0.5">{a.reason}</p>}
                </div>
                <button onClick={() => removeAdmission(i)} className="text-slate hover:text-red shrink-0" aria-label="Remove">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Family history">
        <div className="flex flex-wrap gap-2">
          {FAMILY_HISTORY_OPTIONS.map((f) => (
            <ChipToggle key={f} label={f} active={(profile?.familyHistory || []).includes(f)} onClick={() => onToggleTag('familyHistory', f)} />
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

function ChipToggle({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
        active ? 'bg-rose text-white border-rose' : 'bg-white text-slate border-stone hover:border-rose'
      }`}
    >
      {label}
    </button>
  )
}

// ---------------- Allergies ----------------

function AllergiesTab({ profile, onPersist }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ allergen: '', type: 'Medication', severity: 'Mild', reaction: '', notes: '' })
  const allergies = profile?.allergies || []

  async function addAllergy() {
    if (!form.allergen.trim()) return
    await onPersist({ allergies: [...allergies, form] })
    setForm({ allergen: '', type: 'Medication', severity: 'Mild', reaction: '', notes: '' })
    setShowForm(false)
  }

  async function removeAllergy(index) {
    await onPersist({ allergies: allergies.filter((_, i) => i !== index) })
  }

  return (
    <SectionCard
      title="Allergies"
      action={
        <button onClick={() => setShowForm((v) => !v)} className="text-xs font-medium text-rose hover:underline flex items-center gap-1">
          <Plus size={13} /> Add allergy
        </button>
      }
    >
      {showForm && (
        <div className="bg-white rounded-lg p-3 mb-3 flex flex-col gap-2 border border-sand">
          <input value={form.allergen} onChange={(e) => setForm({ ...form, allergen: e.target.value })} placeholder="Allergen, e.g. Penicillin" className={inputClasses} />
          <div className="grid grid-cols-2 gap-2">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className={inputClasses}>
              {ALLERGY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} className={inputClasses}>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <input value={form.reaction} onChange={(e) => setForm({ ...form, reaction: e.target.value })} placeholder="Reaction, e.g. Anaphylaxis" className={inputClasses} />
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className={inputClasses} />
          <button onClick={addAllergy} className="self-start bg-rose text-white rounded-lg px-4 py-2 text-xs font-medium hover:bg-plum transition-colors">
            Save allergy
          </button>
        </div>
      )}

      {allergies.length === 0 ? (
        <p className="text-sm text-slate">No known allergies on record.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {allergies.map((a, i) => (
            <div key={i} className="bg-white rounded-lg px-3 py-2 flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-ink">{a.allergen}</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_BADGE[a.severity] || 'bg-sand text-slate'}`}>{a.severity}</span>
                </div>
                <p className="text-xs text-slate">{[a.type, a.reaction].filter(Boolean).join(' · ')}</p>
                {a.notes && <p className="text-xs text-slate mt-0.5">{a.notes}</p>}
              </div>
              <button onClick={() => removeAllergy(i)} className="text-slate hover:text-red shrink-0" aria-label="Remove">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

// ---------------- Medications ----------------

function MedicationsTab({ profile, onPersist }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', dosage: '', frequency: '', startDate: '', endDate: '', prescribingDoctor: '', notes: '' })
  const medications = profile?.currentMedications || []

  async function addMedication() {
    if (!form.name.trim()) return
    await onPersist({ currentMedications: [...medications, form] })
    setForm({ name: '', dosage: '', frequency: '', startDate: '', endDate: '', prescribingDoctor: '', notes: '' })
    setShowForm(false)
  }

  async function removeMedication(index) {
    await onPersist({ currentMedications: medications.filter((_, i) => i !== index) })
  }

  return (
    <SectionCard
      title="Current medications"
      action={
        <button onClick={() => setShowForm((v) => !v)} className="text-xs font-medium text-rose hover:underline flex items-center gap-1">
          <Plus size={13} /> Add medication
        </button>
      }
    >
      {showForm && (
        <div className="bg-white rounded-lg p-3 mb-3 flex flex-col gap-2 border border-sand">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Medication name" className={inputClasses} />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="Dosage, e.g. 500mg" className={inputClasses} />
            <input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="Frequency, e.g. Twice daily" className={inputClasses} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start date">
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={inputClasses} />
            </Field>
            <Field label="End date (optional)">
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className={inputClasses} />
            </Field>
          </div>
          <input value={form.prescribingDoctor} onChange={(e) => setForm({ ...form, prescribingDoctor: e.target.value })} placeholder="Prescribing doctor" className={inputClasses} />
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className={inputClasses} />
          <button onClick={addMedication} className="self-start bg-rose text-white rounded-lg px-4 py-2 text-xs font-medium hover:bg-plum transition-colors">
            Save medication
          </button>
        </div>
      )}

      {medications.length === 0 ? (
        <p className="text-sm text-slate">No current medications on record.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {medications.map((m, i) => (
            <div key={i} className="bg-white rounded-lg px-3 py-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-ink">{m.name}</p>
                <p className="text-xs text-slate">{[m.dosage, m.frequency].filter(Boolean).join(' · ')}</p>
                {m.prescribingDoctor && <p className="text-xs text-slate">Prescribed by {m.prescribingDoctor}</p>}
                {m.notes && <p className="text-xs text-slate mt-0.5">{m.notes}</p>}
              </div>
              <button onClick={() => removeMedication(i)} className="text-slate hover:text-red shrink-0" aria-label="Remove">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

// ---------------- Consultations ----------------

const EMPTY_CONSULT_FORM = {
  date: getTodayString(),
  doctor: '',
  reasonForVisit: '',
  diagnosis: '',
  treatment: '',
  followUpRequired: false,
  notes: '',
  height: '',
  weight: '',
  bloodPressure: '',
  pulse: '',
  temperature: '',
  oxygenSaturation: '',
  bloodSugar: '',
}

function ConsultationsTab({ patient, currentUser, consultations, quickNotes, loading, showForm, setShowForm, saving, setSaving, error, setError, onAdded }) {
  const [form, setForm] = useState(EMPTY_CONSULT_FORM)
  const bmi = calculateBmi(form.height, form.weight)

  async function handleAdd() {
    setError('')
    if (!form.date) return setError('Please choose a date.')
    if (!form.reasonForVisit.trim() && !form.diagnosis.trim() && !form.notes.trim()) {
      return setError('Add a reason for visit, diagnosis, or note.')
    }

    setSaving(true)
    try {
      const vitals = {
        height: form.height,
        weight: form.weight,
        bmi,
        bloodPressure: form.bloodPressure,
        pulse: form.pulse,
        temperature: form.temperature,
        oxygenSaturation: form.oxygenSaturation,
        bloodSugar: form.bloodSugar,
      }
      const hasVitals = Object.values(vitals).some((v) => v)

      const newId = await addPatientRecord({
        patientId: patient.id || null,
        patientIdNumber: patient.idNumber || '',
        type: 'consultation',
        title: form.reasonForVisit.trim() || 'Consultation',
        date: form.date,
        doctor: form.doctor.trim(),
        reasonForVisit: form.reasonForVisit.trim(),
        diagnosis: form.diagnosis.trim(),
        treatment: form.treatment.trim(),
        followUpRequired: form.followUpRequired,
        notes: form.notes.trim(),
        vitals: hasVitals ? vitals : null,
        createdBy: currentUser?.uid || null,
      })
      onAdded({
        id: newId,
        type: 'consultation',
        title: form.reasonForVisit.trim() || 'Consultation',
        date: form.date,
        doctor: form.doctor.trim(),
        reasonForVisit: form.reasonForVisit.trim(),
        diagnosis: form.diagnosis.trim(),
        treatment: form.treatment.trim(),
        followUpRequired: form.followUpRequired,
        notes: form.notes.trim(),
        vitals: hasVitals ? vitals : null,
      })
      setForm(EMPTY_CONSULT_FORM)
      setShowForm(false)
    } catch (err) {
      console.error(err)
      setError('Could not save this consultation. Please try again.')
    }
    setSaving(false)
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Add consultation / visit note"
        action={
          <button onClick={() => setShowForm((v) => !v)} className="text-xs font-medium text-rose hover:underline flex items-center gap-1">
            <Plus size={13} /> {showForm ? 'Close' : 'New entry'}
          </button>
        }
      >
        {showForm ? (
          <div className="bg-white rounded-lg p-3 flex flex-col gap-3 border border-sand">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Visit date">
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClasses} />
              </Field>
              <Field label="Doctor">
                <input value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })} placeholder="e.g. Dr. Nkosi" className={inputClasses} />
              </Field>
            </div>
            <Field label="Reason for visit">
              <input value={form.reasonForVisit} onChange={(e) => setForm({ ...form, reasonForVisit: e.target.value })} className={inputClasses} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Diagnosis">
                <input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} className={inputClasses} />
              </Field>
              <Field label="Treatment">
                <input value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} className={inputClasses} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={form.followUpRequired} onChange={(e) => setForm({ ...form, followUpRequired: e.target.checked })} className="rounded border-stone" />
              Follow-up required
            </label>
            <Field label="Notes">
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={inputClasses} />
            </Field>

            <div>
              <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Vital signs (optional)</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <input value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} placeholder="Height (cm)" className={inputClasses} />
                <input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="Weight (kg)" className={inputClasses} />
                <input value={bmi} disabled placeholder="BMI (auto)" className={`${inputClasses} bg-mist text-slate`} />
                <input value={form.bloodPressure} onChange={(e) => setForm({ ...form, bloodPressure: e.target.value })} placeholder="Blood pressure" className={inputClasses} />
                <input value={form.pulse} onChange={(e) => setForm({ ...form, pulse: e.target.value })} placeholder="Pulse (bpm)" className={inputClasses} />
                <input value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} placeholder="Temperature (°C)" className={inputClasses} />
                <input value={form.oxygenSaturation} onChange={(e) => setForm({ ...form, oxygenSaturation: e.target.value })} placeholder="Oxygen saturation (%)" className={inputClasses} />
                <input value={form.bloodSugar} onChange={(e) => setForm({ ...form, bloodSugar: e.target.value })} placeholder="Blood sugar (optional)" className={inputClasses} />
              </div>
            </div>

            {error && <p className="text-red text-xs">{error}</p>}
            <button onClick={handleAdd} disabled={saving} className="self-start bg-rose text-white rounded-lg px-4 py-2 text-xs font-medium hover:bg-plum transition-colors disabled:opacity-60">
              {saving ? 'Saving...' : 'Save entry'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate">Log a consultation, vitals, or a quick note from this visit.</p>
        )}
      </SectionCard>

      <div>
        <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2">Visit history</p>
        {loading ? (
          <p className="text-sm text-slate">Loading...</p>
        ) : consultations.length === 0 && quickNotes.length === 0 ? (
          <p className="text-sm text-slate">No consultations or notes on file yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {[...consultations, ...quickNotes]
              .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
              .map((r) => (
                <div key={r.id} className="bg-mist rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-ink">{r.title}</p>
                    <p className="text-xs text-slate">{r.date ? formatShortDate(r.date) : ''}</p>
                  </div>
                  {r.type === 'consultation' ? (
                    <>
                      {r.doctor && <p className="text-xs text-slate">Seen by {r.doctor}</p>}
                      {r.diagnosis && <p className="text-sm text-ink mt-1">Diagnosis: {r.diagnosis}</p>}
                      {r.treatment && <p className="text-sm text-ink">Treatment: {r.treatment}</p>}
                      {r.followUpRequired && <p className="text-xs text-amber mt-1">Follow-up required</p>}
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
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}