// Searchable, alphabetical patient directory with record access (must-have).
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, FileText, Calendar as CalendarIcon, UserCircle2, NotebookPen } from 'lucide-react'
import {
  subscribeToPatients,
  getPatientRecords,
  getRecordsByIdNumber,
  getPatientProfile,
  getPatientProfileByIdNumber,
  getUnlinkedWalkInPatients,
} from '../../firebase/firestore'
import { useAppointments } from '../../hooks/useAppointments'
import SecretaryLayout from './SecretaryLayout'
import PatientRecordModal from './PatientRecordModal'
import BackButton from '../../components/BackButton'
import Card from '../../components/Card'
import Avatar from '../../components/Avatar'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import EmptyState from '../../components/EmptyState'
import { formatShortDate, formatTime, getTodayString } from '../../utils/dateHelpers'

export default function PatientList() {
  const location = useLocation()
  const { appointments } = useAppointments()

  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const [walkIns, setWalkIns] = useState([])

  const [selectedPatient, setSelectedPatient] = useState(null)
  const [profile, setProfile] = useState(null)
  const [records, setRecords] = useState([])
  const [overviewLoading, setOverviewLoading] = useState(false)

  const [fullRecordOpen, setFullRecordOpen] = useState(false)
  const [fullRecordTab, setFullRecordTab] = useState('overview')
  const [fullRecordAutoAdd, setFullRecordAutoAdd] = useState(false)

  useEffect(() => {
    const unsub = subscribeToPatients(list => {
      setPatients(list)
      setLoading(false)
    })
    return () => unsub && unsub()
  }, [])


  useEffect(() => {
    getUnlinkedWalkInPatients()
      .then(setWalkIns)
      .catch(() => setWalkIns([]))
  }, [appointments])

  // Support being deep-linked from the dashboard search results
  useEffect(() => {
    const openId = location.state?.openPatientId
    if (openId && patients.length > 0) {
      const p = patients.find(p => p.id === openId)
      if (p) openPatient(p)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, patients])

  const filteredPatients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return patients
    return patients.filter(p =>
      (p.name || '').toLowerCase().includes(term) ||
      (p.email || '').toLowerCase().includes(term) ||
      (p.idNumber || '').toLowerCase().includes(term)
    )
  }, [patients, searchTerm])

  const filteredWalkIns = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return walkIns
    return walkIns.filter(p =>
      (p.name || '').toLowerCase().includes(term) ||
      (p.idNumber || '').toLowerCase().includes(term)
    )
  }, [walkIns, searchTerm])

  async function openPatient(patient) {
    setSelectedPatient(patient)
    setOverviewLoading(true)
    try {
      const [r, p] = await Promise.all([
        patient.id ? getPatientRecords(patient.id) : getRecordsByIdNumber(patient.idNumber),
        patient.id ? getPatientProfile(patient.id) : getPatientProfileByIdNumber(patient.idNumber),
      ])
      setRecords(r)
      setProfile(p)
    } catch {
      setRecords([])
      setProfile(null)
    }
    setOverviewLoading(false)
  }

  function closeOverview() {
    setSelectedPatient(null)
    setProfile(null)
    setRecords([])
  }

  function openFullRecord(tab, autoAdd = false) {
    setFullRecordTab(tab)
    setFullRecordAutoAdd(autoAdd)
    setFullRecordOpen(true)
  }

  const patientAppointments = useMemo(() => {
    if (!selectedPatient) return []
    return appointments
      .filter(a =>
        selectedPatient.id
          ? a.patientId === selectedPatient.id
          : !a.patientId && a.patientIdNumber === selectedPatient.idNumber
      )
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  }, [appointments, selectedPatient])

  const today = getTodayString()
  const nextAppointment = useMemo(
    () =>
      [...patientAppointments]
        .filter(a => a.date >= today && a.status !== 'cancelled')
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] || null,
    [patientAppointments, today],
  )
  const lastVisit = useMemo(
    () => patientAppointments.find(a => a.date < today) || null,
    [patientAppointments, today],
  )

  return (
    <SecretaryLayout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <BackButton />
        <h1 className="text-2xl font-semibold text-ink mb-1">Patients</h1>
        <p className="text-slate text-sm mb-6">Search and manage all registered patients</p>

        <div className="relative mb-6">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or ID number..."
            className="w-full border border-stone rounded-xl pl-10 pr-4 py-3 text-ink bg-white focus:border-rose focus:outline-none"
          />
        </div>

        <Card padded={false}>
          {loading ? (
            <p className="text-slate text-sm px-5 py-8 text-center">Loading patients...</p>
          ) : filteredPatients.length === 0 && filteredWalkIns.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No patients found"
              message="Try a different name, email, or ID number."
            />
          ) : (
            <div className="divide-y divide-sand">
              {filteredPatients.map(p => (
                <button
                  key={p.id}
                  onClick={() => openPatient(p)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-mist transition-colors"
                >
                  <Avatar name={p.name} size={40} />
                  <div>
                    <p className="text-sm font-medium text-ink">{p.name}</p>
                    <p className="text-xs text-slate">
                      {p.idNumber && <> ID: {p.idNumber}</>}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {filteredWalkIns.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-slate uppercase tracking-wide mb-2">
              Walk-in patients (not yet registered)
            </h2>
           
            <Card padded={false}>
              <div className="divide-y divide-sand">
                {filteredWalkIns.map(p => (
                  <button
                    key={p.idNumber}
                    onClick={() => openPatient(p)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-mist transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-blush flex items-center justify-center shrink-0">
                      <UserCircle2 size={22} className="text-plum" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink">{p.name || 'Unnamed patient'}</p>
                      <p className="text-xs text-slate">
                        ID: {p.idNumber}
                        {p.phone && <> · {p.phone}</>}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Quick overview popup */}
      <Modal
        isOpen={!!selectedPatient}
        onClose={closeOverview}
        title={selectedPatient?.name || 'Patient'}
        hideFooter
      >
        {selectedPatient && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <Avatar name={selectedPatient.name} size={56} />
              <div>
                <p className="font-medium text-ink">{selectedPatient.name || 'Unnamed patient'}</p>
                {selectedPatient.email && <p className="text-sm text-slate">{selectedPatient.email}</p>}
                {selectedPatient.phone && <p className="text-sm text-slate">{selectedPatient.phone}</p>}
                {selectedPatient.idNumber && (
                  <p className="text-sm text-slate">ID: {selectedPatient.idNumber}</p>
                )}
                {!selectedPatient.id && (
                  <p className="text-xs font-medium text-amber mt-1">Not yet registered</p>
                )}
              </div>
            </div>

            {overviewLoading ? (
              <p className="text-sm text-slate">Loading overview...</p>
            ) : (
              <>
                {/* Quick medical snapshot */}
                <div className="bg-mist rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate">Blood group</p>
                    <p className="text-ink">{profile?.bloodGroup || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate">Primary doctor</p>
                    <p className="text-ink">{profile?.primaryDoctor || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate">Last visit</p>
                    <p className="text-ink">{lastVisit ? formatShortDate(lastVisit.date) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate">Next appointment</p>
                    <p className="text-ink">{nextAppointment ? formatShortDate(nextAppointment.date) : '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate mb-1">Allergies</p>
                    {(profile?.allergies || []).length === 0 ? (
                      <p className="text-ink">None on record</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {profile.allergies.map((a, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full text-xs font-medium bg-pastel-red text-red">
                            {a.allergen}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate">Chronic conditions</p>
                    <p className="text-ink">{(profile?.chronicConditions || []).join(', ') || '—'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate">Current medications</p>
                    <p className="text-ink">
                      {(profile?.currentMedications || []).map(m => m.name).filter(Boolean).join(', ') || '—'}
                    </p>
                  </div>
                </div>

                {/* Recent activity */}
                <div>
                  <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2 flex items-center gap-2">
                    <FileText size={14} /> Recent records
                  </p>
                  {records.length === 0 ? (
                    <p className="text-sm text-slate">No records on file yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {records.slice(0, 3).map(r => (
                        <div key={r.id} className="bg-mist rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-ink">{r.title}</p>
                            {r.internalOnly && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sand text-slate">
                                Staff only
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate">{formatShortDate(r.date)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2 flex items-center gap-2">
                    <CalendarIcon size={14} /> Appointments
                  </p>
                  {patientAppointments.length === 0 ? (
                    <p className="text-sm text-slate">No appointments on record.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {patientAppointments.slice(0, 3).map(a => (
                        <div key={a.id} className="flex items-center justify-between bg-mist rounded-lg px-3 py-2">
                          <p className="text-sm text-ink">{formatShortDate(a.date)} · {formatTime(a.time)}</p>
                          <Badge status={a.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => openFullRecord('consultations', true)}
                    className="flex-1 flex items-center justify-center gap-2 border border-stone text-ink rounded-xl py-3 text-sm font-medium hover:border-rose transition-colors"
                  >
                    <NotebookPen size={16} /> Add note
                  </button>
                  <button
                    onClick={() => openFullRecord('overview', false)}
                    className="flex-1 bg-rose text-white rounded-xl py-3 text-sm font-medium hover:bg-plum transition-colors"
                  >
                    View full record
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Full patient record */}
      {fullRecordOpen && selectedPatient && (
        <PatientRecordModal
          patient={selectedPatient}
          appointments={patientAppointments}
          initialTab={fullRecordTab}
          autoOpenAddForm={fullRecordAutoAdd}
          onClose={() => setFullRecordOpen(false)}
        />
      )}
    </SecretaryLayout>
  )
}