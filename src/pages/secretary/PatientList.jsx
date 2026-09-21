// Searchable patient directory for the secretary portal.
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Search } from 'lucide-react'
import { subscribeToPatients } from '../../firebase/firestore'
import { useAppointments } from '../../hooks/useAppointments'
import SecretaryLayout from './SecretaryLayout'
import PatientRecordModal from './PatientRecordModal'
import Card from '../../components/Card'
import Avatar from '../../components/Avatar'
import EmptyState from '../../components/EmptyState'

export default function PatientList() {
  const location = useLocation()
  const { appointments } = useAppointments()
  const [patients, setPatients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [selectedTab, setSelectedTab] = useState('overview')

  useEffect(() => {
    const unsubscribe = subscribeToPatients((nextPatients) => {
      setPatients(nextPatients)
      setLoading(false)
    })
    return () => {
      unsubscribe && unsubscribe()
    }
  }, [])

  useEffect(() => {
    const openPatientId = location.state?.openPatientId
    if (!openPatientId) return
    const patient = patients.find((item) => item.id === openPatientId)
    if (!patient) return
    queueMicrotask(() => {
      setSelectedPatient(patient)
      setSelectedTab(location.state?.openTab || 'overview')
    })
  }, [location.state, patients])

  const filteredPatients = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return patients
    return patients.filter((patient) =>
      [patient.name, patient.email, patient.idNumber]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term)),
    )
  }, [patients, searchTerm])

  return (
    <SecretaryLayout>
      <div className="p-6 md:p-8 max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-ink">Patients</h1>
          <p className="text-sm text-slate mt-1">Search and open a patient's full record.</p>
        </div>

        <Card className="mb-6">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, email, or ID number..."
              className="w-full border border-stone rounded-xl pl-10 pr-4 py-3 text-ink focus:border-rose focus:outline-none"
            />
          </div>
        </Card>

        {loading ? (
          <p className="text-sm text-slate text-center py-10">Loading patients...</p>
        ) : filteredPatients.length === 0 ? (
          <EmptyState
            icon={Search}
            title={searchTerm ? 'No patients found' : 'No registered patients'}
            message={searchTerm ? 'Try a different name, email, or ID number.' : 'Registered patients will appear here.'}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {filteredPatients.map((patient) => (
              <button
                key={patient.id}
                onClick={() => {
                  setSelectedPatient(patient)
                  setSelectedTab('overview')
                }}
                className="w-full flex items-center gap-3 bg-white rounded-xl p-4 text-left hover:bg-mist transition-colors"
              >
                <Avatar name={patient.name} size={42} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{patient.name || 'Unnamed patient'}</p>
                  <p className="text-xs text-slate truncate">{patient.email || patient.idNumber || 'No contact details'}</p>
                </div>
                <span className="ml-auto text-xs font-medium text-rose">View record</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedPatient && (
        <PatientRecordModal
          patient={selectedPatient}
          appointments={appointments}
          initialTab={selectedTab}
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </SecretaryLayout>
  )
}
