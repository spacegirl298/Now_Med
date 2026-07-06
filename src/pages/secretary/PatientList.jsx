// Searchable, alphabetical patient directory with record access (must-have).
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Search, FileText, Calendar as CalendarIcon } from 'lucide-react'
import { subscribeToPatients, getPatientRecords } from '../../firebase/firestore'
import { useAppointments } from '../../hooks/useAppointments'
import SecretaryLayout from './SecretaryLayout'
import Card from '../../components/Card'
import Avatar from '../../components/Avatar'
import Badge from '../../components/Badge'
import Modal from '../../components/Modal'
import EmptyState from '../../components/EmptyState'
import { formatShortDate, formatTime } from '../../utils/dateHelpers'

export default function PatientList() {
  const location = useLocation()
  const { appointments } = useAppointments()

  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const [selectedPatient, setSelectedPatient] = useState(null)
  const [records, setRecords] = useState([])
  const [recordsLoading, setRecordsLoading] = useState(false)

  useEffect(() => {
    const unsub = subscribeToPatients(list => {
      setPatients(list)
      setLoading(false)
    })
    return () => unsub && unsub()
  }, [])

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
      (p.email || '').toLowerCase().includes(term)
    )
  }, [patients, searchTerm])

  async function openPatient(patient) {
    setSelectedPatient(patient)
    setRecordsLoading(true)
    try {
      const r = await getPatientRecords(patient.id)
      setRecords(r)
    } catch {
      setRecords([])
    }
    setRecordsLoading(false)
  }

  const patientAppointments = useMemo(() => {
    if (!selectedPatient) return []
    return appointments
      .filter(a => a.patientId === selectedPatient.id)
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
  }, [appointments, selectedPatient])

  return (
    <SecretaryLayout>
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-ink mb-1">Patients</h1>
        <p className="text-slate text-sm mb-6">Search and manage all registered patients</p>

        <div className="relative mb-6">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full border border-stone rounded-xl pl-10 pr-4 py-3 text-ink bg-white focus:border-rose focus:outline-none"
          />
        </div>

        <Card padded={false}>
          {loading ? (
            <p className="text-slate text-sm px-5 py-8 text-center">Loading patients...</p>
          ) : filteredPatients.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No patients found"
              message="Try a different name or email."
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
                    <p className="text-xs text-slate">{p.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
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
                <p className="font-medium text-ink">{selectedPatient.name}</p>
                <p className="text-sm text-slate">{selectedPatient.email}</p>
                {selectedPatient.phone && <p className="text-sm text-slate">{selectedPatient.phone}</p>}
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
              <p className="text-xs font-semibold text-slate uppercase tracking-wide mb-2 flex items-center gap-2">
                <FileText size={14} /> Medical records
              </p>
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
