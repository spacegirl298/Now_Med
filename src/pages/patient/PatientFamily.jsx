// Parent's family overview: one card per child with their next appointment and
// any live delay, plus the "Add a child" flow. Opening a card goes to
// /patient/family/:childId.
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Users, Clock, ShieldAlert } from 'lucide-react'
import PatientLayout from './PatientLayout'
import Avatar from '../../components/Avatar'
import Button from '../../components/Button'
import EmptyState from '../../components/EmptyState'
import AddChildModal from '../../components/family/AddChildModal'
import { useChildren } from '../../hooks/useChildren'
import { subscribeToPatientAppointments } from '../../firebase/firestore'
import { formatAge, transitionStage, ageTier } from '../../utils/childAge'
import { formatShortDate, formatTime, getTodayString, isPastSlot } from '../../utils/dateHelpers'

function useUpcoming(childId) {
  const [appointments, setAppointments] = useState([])
  useEffect(() => {
    const unsub = subscribeToPatientAppointments(
      childId,
      setAppointments,
      (err) => console.error('Could not load a child appointment list:', err),
    )
    return () => unsub && unsub()
  }, [childId])

  return useMemo(() => {
    const today = getTodayString()
    const upcoming = appointments.filter(
      (a) => a.status !== 'cancelled' && a.date >= today && !isPastSlot(a.date, a.time),
    )
    return upcoming[0] || null
  }, [appointments])
}

function Chip({ tone, children }) {
  const tones = {
    amber: 'bg-pastel-amber text-amber',
    blue: 'bg-pastel-blue text-blue',
    green: 'bg-pastel-green text-green',
  }
  return <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${tones[tone]}`}>{children}</span>
}

function ChildCard({ child, onOpen }) {
  const next = useUpcoming(child.id)
  const stage = transitionStage(child.dateOfBirth)
  const tier = ageTier(child.dateOfBirth)

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left bg-white rounded-2xl p-5 hover:bg-mist transition-colors focus-visible:outline-2 focus-visible:outline-rose"
    >
      <div className="flex items-center gap-3 mb-4">
        <Avatar name={child.name} size={48} />
        <div className="min-w-0">
          <p className="font-semibold text-ink truncate">{child.name}</p>
          <p className="text-sm text-slate">{formatAge(child.dateOfBirth)} old</p>
        </div>
      </div>

      {next ? (
        <div className="flex items-start gap-2 text-sm text-ink">
          <Clock size={16} className="text-rose shrink-0 mt-0.5" />
          <span>
            Next visit: {formatShortDate(next.date)} at {formatTime(next.time)}
            {next.doctorName ? ` with ${next.doctorName}` : ''}
          </span>
        </div>
      ) : (
        <p className="text-sm text-slate">No upcoming appointments</p>
      )}

      <div className="flex flex-wrap gap-2 mt-3">
        {next?.status === 'delayed' && next.delayMinutes > 0 && (
          <Chip tone="amber">Running {next.delayMinutes} min late</Chip>
        )}
        {child.verificationStatus === 'pending' && <Chip tone="blue">Waiting for the practice to confirm</Chip>}
        {tier === 'teen' && <Chip tone="blue">Can consent to own treatment</Chip>}
        {stage === 'notice' && <Chip tone="amber">Turns 18 soon</Chip>}
      </div>
    </button>
  )
}

export default function PatientFamily() {
  const { children: kids, loading, error } = useChildren()
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()

  return (
    <PatientLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-ink">Family</h1>
            <p className="text-sm text-slate mt-1">
              Manage appointments, messages and records for your children.
            </p>
          </div>
          {kids.length > 0 && (
            <Button onClick={() => setAdding(true)}>
              <span className="inline-flex items-center gap-1.5">
                <Plus size={16} /> Add child
              </span>
            </Button>
          )}
        </div>

        {error && (
          <div role="alert" className="bg-pastel-red text-red text-sm rounded-xl px-4 py-3 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate text-center py-10">Loading your family...</p>
        ) : kids.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No children added yet"
            message="Add a child to book for them, follow their visits and message the practice on their behalf."
            actionLabel="Add a child"
            onAction={() => setAdding(true)}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {kids.map((child) => (
              <ChildCard key={child.id} child={child} onOpen={() => navigate(`/patient/family/${child.id}`)} />
            ))}
          </div>
        )}

        <p className="flex items-start gap-2 text-xs text-slate mt-8">
          <ShieldAlert size={14} className="shrink-0 mt-0.5" />
          From the age of 12, children can consent to their own treatment under South African law,
          so the practice may keep some of their information private from parents.
        </p>
      </div>

      <AddChildModal
        isOpen={adding}
        onClose={() => setAdding(false)}
        onCreated={(childId) => {
          setAdding(false)
          navigate(`/patient/family/${childId}`)
        }}
      />
    </PatientLayout>
  )
}
