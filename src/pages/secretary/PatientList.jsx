// Searchable, alphabetical patient directory with record access (must-have).
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, FileText, Calendar as CalendarIcon, Plus, UserCircle2 } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  subscribeToPatients,
  getPatientRecords,
  getRecordsByIdNumber,
  addPatientRecord,
  getUnlinkedWalkInPatients,
} from '../../firebase/firestore'
import { useAppointments } from '../../hooks/useAppointments'
import SecretaryLayout from './SecretaryLayout'
import BackButton from '../../components/BackButton'
import Card from '../../components/Card'
import Avatar from '../../components/Avatar'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import EmptyState from '../../components/EmptyState'
import { formatShortDate, formatTime, getTodayString } from '../../utils/dateHelpers'

const EMPTY_RECORD_FORM = { title: '', date: getTodayString(), notes: '' }

export default function PatientList() {
  const location = useLocation()
  const { currentUser } = useAuth()
  const { appointments } = useAppointments()

  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const [walkIns, setWalkIns] = useState([])

  const [selectedPatient, setSelectedPatient] = useState(null)
  const [records, setRecords] = useState([])
  const [recordsLoading, setRecordsLoading] = useState(false)

  const [showRecordForm, setShowRecordForm] = useState(false)
  const [recordForm, setRecordForm] = useState(EMPTY_RECORD_FORM)
  const [recordError, setRecordError] = useState('')
  const [savingRecord, setSavingRecord] = useState(false)

  useEffect(() => {
    const unsub = subscribeToPatients(list => {
      setPatients(list)
      setLoading(false)
    })
    return () => unsub && unsub()
  }, [])

  // Walk-in patients: booked by phone/email/in person but who haven't
  // created an account yet, so they only exist as an ID number on their
  // appointments. Refetched whenever the appointment list changes so a
  // brand-new walk-in booking shows up here right away.
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
    setShowRecordForm(false)
    setRecordForm(EMPTY_RECORD_FORM)
    setRecordError('')
    setRecordsLoading(true)
    try {
      const r = patient.id
        ? await getPatientRecords(patient.id)
        : await getRecordsByIdNumber(patient.idNumber)
      setRecords(r)
    } catch {
      setRecords([])
    }
    setRecordsLoading(false)
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

  async function handleAddRecord() {
    setRecordError('')
    if (!recordForm.title.trim()) return setRecordError('Please enter a title for this record.')
    if (!recordForm.date) return setRecordError('Please choose a date.')

    setSavingRecord(true)
    try {
      const newId = await addPatientRecord({
        patientId: selectedPatient.id || null,
        patientIdNumber: selectedPatient.idNumber || '',
        title: recordForm.title.trim(),
        date: recordForm.date,
        notes: recordForm.notes.trim(),
        createdBy: currentUser?.uid || null,
      })
      setRecords(prev => [
        { id: newId, ...recordForm, title: recordForm.title.trim() },
        ...prev,
      ])
      setRecordForm(EMPTY_RECORD_FORM)
      setShowRecordForm(false)
    } catch (err) {
      console.error(err)
      setRecordError('Could not save this record. Please try again.')
    }
    setSavingRecord(false)
  }

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
            <p className="text-xs text-slate mb-3">
              Booked by phone, email, or in person. They'll move into the list above
              automatically once they create an account with a matching ID number.
            </p>
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

      {/* Patient detail modal */}
      <Modal
        isOpen={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        title={selectedPatient?.name || 'Patient'}
        hideFooter
      >
        {selectedPatient && (
          <div className="flex flex-col gap-6">
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

            <div>
              <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2 flex items-center gap-2">
                <CalendarIcon size={14} /> Appointment history
              </p>
              {patientAppointments.length === 0 ? (
                <p className="text-sm text-slate">No appointments on record.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {patientAppointments.map(a => (
                    <div key={a.id} className="flex items-center justify-between bg-mist rounded-lg px-3 py-2">
                      <p className="text-sm text-ink">{formatShortDate(a.date)} · {formatTime(a.time)}</p>
                      <Badge status={a.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate uppercase tracking-wide flex items-center gap-2">
                  <FileText size={14} /> Medical records
                </p>
                <button
                  onClick={() => setShowRecordForm(v => !v)}
                  className="text-xs font-medium text-rose hover:underline flex items-center gap-1"
                >
                  <Plus size={13} /> Add record
                </button>
              </div>

              {showRecordForm && (
                <div className="bg-mist rounded-xl p-3 mb-3 flex flex-col gap-2">
                  <input
                    value={recordForm.title}
                    onChange={e => setRecordForm({ ...recordForm, title: e.target.value })}
                    placeholder="Record title, e.g. Blood test results"
                    className="w-full border border-stone rounded-lg px-3 py-2 text-sm text-ink bg-white focus:border-rose focus:outline-none"
                  />
                  <input
                    type="date"
                    value={recordForm.date}
                    onChange={e => setRecordForm({ ...recordForm, date: e.target.value })}
                    className="w-full border border-stone rounded-lg px-3 py-2 text-sm text-ink bg-white focus:border-rose focus:outline-none"
                  />
                  <textarea
                    value={recordForm.notes}
                    onChange={e => setRecordForm({ ...recordForm, notes: e.target.value })}
                    placeholder="Notes (optional)"
                    rows={2}
                    className="w-full border border-stone rounded-lg px-3 py-2 text-sm text-ink bg-white focus:border-rose focus:outline-none"
                  />
                  {recordError && <p className="text-red text-xs">{recordError}</p>}
                  <button
                    onClick={handleAddRecord}
                    disabled={savingRecord}
                    className="self-start bg-rose text-white rounded-lg px-4 py-2 text-xs font-medium hover:bg-plum transition-colors disabled:opacity-60"
                  >
                    {savingRecord ? 'Saving...' : 'Save record'}
                  </button>
                </div>
              )}

              {recordsLoading ? (
                <p className="text-sm text-slate">Loading records...</p>
              ) : records.length === 0 ? (
                <p className="text-sm text-slate">No records on file for this patient.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {records.map(r => (
                    <div key={r.id} className="bg-mist rounded-lg px-3 py-2">
                      <p className="text-sm text-ink">{r.title}</p>
                      <p className="text-xs text-slate">{r.date}</p>
                      {r.notes && <p className="text-xs text-slate mt-0.5">{r.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </SecretaryLayout>
  )
}