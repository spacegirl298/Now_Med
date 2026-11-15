// One child's page for their parent: appointments (with live delay info),
// the chat with the practice, records, and details + the 18th-birthday
// hand-over. Route: /patient/family/:childId
//
// Access is checked here for a friendly message, but the database rules are
// what actually enforce it (see FAMILY_SETUP.md).
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarPlus, ChevronLeft, FileText, ShieldAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import PatientLayout from './PatientLayout'
import Avatar from '../../components/Avatar'
import Badge from '../../components/Badge'
import Card from '../../components/Card'
import EmptyState from '../../components/EmptyState'
import JoinLink from '../../components/JoinLink'
import ChatThread from '../../components/ChatThread'
import TransitionCard from '../../components/family/TransitionCard'
import { subscribeToChild, RELATIONSHIPS } from '../../firebase/firestore'
import {
  subscribeToPatientAppointments,
  subscribeToPatientRecords,
  subscribeToMessages,
  subscribeToConversation,
  sendMessage,
  markConversationRead,
  markChatNotificationsRead,
} from '../../firebase/firestore'
import { ageTier, formatAge, isManageable } from '../../utils/childAge'
import {
  formatDisplayDate,
  formatShortDate,
  formatTime,
  getTodayString,
  isPastSlot,
} from '../../utils/dateHelpers'

// Children aged 12+ can consent to their own treatment, so by default a parent
// does not see their clinical records until the practice has a way to flag
// what is private. Flip to true to share records with parents of teenagers.
const SHOW_RECORDS_TO_PARENTS_OF_TEENS = false

const TABS = [
  { id: 'appointments', label: 'Appointments' },
  { id: 'messages', label: 'Messages' },
  { id: 'records', label: 'Records' },
  { id: 'about', label: 'About' },
]

// ---------- Appointments ----------

function ChildAppointments({ child }) {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const unsub = subscribeToPatientAppointments(
      child.id,
      (list) => {
        setAppointments(list)
        setError('')
        setLoading(false)
      },
      (err) => {
        console.error('Could not load child appointments:', err)
        setError("We couldn't load appointments for this profile.")
        setLoading(false)
      },
    )
    return () => unsub && unsub()
  }, [child.id])

  const { upcoming, past } = useMemo(() => {
    const today = getTodayString()
    const isUpcoming = (a) => a.status !== 'cancelled' && a.date >= today && !isPastSlot(a.date, a.time)
    return {
      upcoming: appointments.filter(isUpcoming),
      past: appointments.filter((a) => !isUpcoming(a)).reverse().slice(0, 5),
    }
  }, [appointments])

  if (loading) return <p className="text-sm text-slate text-center py-10">Loading appointments...</p>

  const row = (a) => (
    <li key={a.id} className="bg-white rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            {formatShortDate(a.date)} at {formatTime(a.time)}
          </p>
          <p className="text-xs text-slate capitalize">
            {a.type} consult{a.doctorName ? ` with ${a.doctorName}` : ''}
          </p>
        </div>
        <Badge status={a.status} />
      </div>
      {a.status === 'delayed' && a.delayMinutes > 0 && (
        <p className="text-xs text-amber bg-pastel-amber rounded-lg px-3 py-2 mt-3">
          The practice is running about {a.delayMinutes} minutes late.
          {a.delayNote ? ` ${a.delayNote}` : ''}
        </p>
      )}
      {a.type === 'virtual' && a.status !== 'cancelled' && !isPastSlot(a.date, a.time) && (
        <JoinLink appointment={a} variant="pill" className="mt-3" />
      )}
    </li>
  )

  return (
    <div className="flex flex-col gap-5">
      {error && <p role="alert" className="text-sm text-red bg-pastel-red rounded-xl px-4 py-3">{error}</p>}

      {upcoming.length === 0 ? (
        <EmptyState
          icon={CalendarPlus}
          title="No upcoming appointments"
          message={`Book a visit for ${child.firstName}.`}
          actionLabel="Book an appointment"
          onAction={() => navigate(`/patient/family/${child.id}/calendar`)}
        />
      ) : (
        <ul className="flex flex-col gap-3">{upcoming.map(row)}</ul>
      )}

      {past.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-ink mb-2">Recent visits</h3>
          <ul className="flex flex-col gap-3">{past.map(row)}</ul>
        </div>
      )}
    </div>
  )
}

// ---------- Messages ----------

function ChildMessages({ child }) {
  const { currentUser, userName } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [conversation, setConversation] = useState(null)

  useEffect(() => {
    const onError = (err) => {
      console.error(err)
      setLoadError('Could not load messages. Please try again or contact the practice.')
      setLoading(false)
    }
    const unsubMessages = subscribeToMessages(child.id, (list) => { setMessages(list); setLoading(false) }, onError)
    const unsubConversation = subscribeToConversation(child.id, setConversation, onError)
    return () => {
      unsubMessages && unsubMessages()
      unsubConversation && unsubConversation()
    }
  }, [child.id])

  const unread = conversation?.unreadForPatient || 0
  useEffect(() => {
    if (unread > 0) markConversationRead(child.id, 'patient').catch(console.error)
  }, [child.id, unread])

  useEffect(() => {
    markChatNotificationsRead(child.id).catch(console.error)
  }, [child.id])

  function handleSend(text) {
    return sendMessage({
      patientId: child.id,
      patientName: child.name,
      senderRole: 'patient',
      senderName: `${userName || currentUser?.displayName || 'Parent'} (guardian of ${child.firstName})`,
      text,
    })
  }

  return (
    <div>
      <p className="text-sm text-slate mb-3">
        This is {child.firstName}'s own conversation with the practice. For anything urgent, call
        the practice or emergency services instead of waiting for a reply here.
      </p>
      {loadError && <p role="alert" className="text-sm text-red bg-pastel-red rounded-xl px-4 py-3 mb-3">{loadError}</p>}
      <div className="h-[60dvh] bg-mist rounded-2xl overflow-hidden">
        <ChatThread
          messages={messages}
          myRole="patient"
          loading={loading}
          onSend={handleSend}
          emptyMessage={`No messages yet. Message the practice about ${child.firstName}.`}
          placeholder={`Message the practice about ${child.firstName}...`}
        />
      </div>
    </div>
  )
}

// ---------- Records ----------

function ChildRecords({ child }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const tier = ageTier(child.dateOfBirth)
  const verified = child.verificationStatus === 'verified'
  const allowed = verified && (tier !== 'teen' || SHOW_RECORDS_TO_PARENTS_OF_TEENS)

  useEffect(() => {
    if (!allowed) return
    const unsub = subscribeToPatientRecords(
      child.id,
      (list) => {
        // Same rule as the patient's own Records page: staff-only notes stay hidden.
        setRecords(list.filter((r) => !r.internalOnly))
        setLoading(false)
      },
      (err) => {
        console.error('Could not load child records:', err)
        setError("We couldn't load these records.")
        setLoading(false)
      },
    )
    return () => unsub && unsub()
  }, [child.id, allowed])

  if (!verified) {
    return (
      <Card>
        <p className="flex items-start gap-2 text-sm text-ink">
          <ShieldAlert size={18} className="text-amber shrink-0 mt-0.5" />
          The practice needs to confirm you're {child.firstName}'s parent or guardian before you can
          see medical records. They may ask you for a copy of the birth certificate.
        </p>
      </Card>
    )
  }
  if (!allowed) {
    return (
      <Card>
        <p className="flex items-start gap-2 text-sm text-ink">
          <ShieldAlert size={18} className="text-rose shrink-0 mt-0.5" />
          {child.firstName} is 12 or older and can consent to their own treatment, so their medical
          records are private by default. Ask the practice if you need information from a visit.
        </p>
      </Card>
    )
  }
  if (loading) return <p className="text-sm text-slate text-center py-10">Loading records...</p>
  if (error) return <p role="alert" className="text-sm text-red bg-pastel-red rounded-xl px-4 py-3">{error}</p>
  if (records.length === 0) {
    return <EmptyState icon={FileText} title="No records yet" message={`Records from ${child.firstName}'s visits will show up here.`} />
  }

  return (
    <ul className="flex flex-col gap-3">
      {records.map((r) => (
        <li key={r.id} className="bg-white rounded-2xl p-4">
          <p className="text-sm font-medium text-ink">{r.title || 'Visit note'}</p>
          <p className="text-xs text-slate mb-2">
            {r.date ? formatDisplayDate(r.date) : ''}
            {r.doctor ? ` · ${r.doctor}` : ''}
          </p>
          {r.diagnosis && <p className="text-sm text-ink"><span className="text-slate">Diagnosis: </span>{r.diagnosis}</p>}
          {r.treatment && <p className="text-sm text-ink"><span className="text-slate">Treatment: </span>{r.treatment}</p>}
          {r.notes && <p className="text-sm text-ink whitespace-pre-wrap break-words">{r.notes}</p>}
        </li>
      ))}
    </ul>
  )
}

// ---------- About ----------

function ChildAbout({ child }) {
  const { currentUser } = useAuth()
  const myRelationship = child.guardians?.[currentUser?.uid]?.relationship
  const relationshipLabel = RELATIONSHIPS.find((r) => r.value === myRelationship)?.label || '-'
  const tier = ageTier(child.dateOfBirth)
  const idLabel =
    child.idType === 'sa_id' ? 'SA ID number' : child.idType === 'birth_certificate' ? 'Birth certificate' : 'Not added'

  const facts = [
    ['Date of birth', formatDisplayDate(child.dateOfBirth)],
    ['Age', formatAge(child.dateOfBirth)],
    ['Your relationship', relationshipLabel],
    ['Identity document', child.idNumber ? `${idLabel} ending ${child.idNumber.slice(-4)}` : idLabel],
    ['Guardians', String(child.guardianIds?.length || 1)],
    ['Status', child.verificationStatus === 'verified' ? 'Confirmed by the practice' : 'Waiting for the practice to confirm'],
  ]

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-3 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="bg-mist rounded-xl px-3 py-2">
              <p className="text-xs text-slate">{label}</p>
              <p className="text-ink break-words">{value}</p>
            </div>
          ))}
        </div>
      </Card>

      {tier === 'teen' && (
        <Card>
          <p className="text-sm text-ink">
            {child.firstName} is old enough to consent to their own treatment under the Children's
            Act, so the practice may keep some information between them and their doctor.
          </p>
        </Card>
      )}

      <TransitionCard child={child} />
    </div>
  )
}

// ---------- Page ----------

export default function PatientChild() {
  const { childId } = useParams()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [child, setChild] = useState(undefined) // undefined = loading, null = unavailable
  const [tab, setTab] = useState('appointments')

  useEffect(() => {
    const unsub = subscribeToChild(
      childId,
      setChild,
      (err) => {
        console.error('Could not load child profile:', err)
        setChild(null)
      },
    )
    return () => unsub && unsub()
  }, [childId])

  const allowed = child && child.guardianIds?.includes(currentUser?.uid) && isManageable(child)

  return (
    <PatientLayout>
      <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto">
        <Link to="/patient/family" className="inline-flex items-center gap-1 text-sm text-slate hover:text-ink py-2 mb-2">
          <ChevronLeft size={16} /> Family
        </Link>

        {child === undefined ? (
          <p className="text-sm text-slate text-center py-10">Loading...</p>
        ) : !allowed ? (
          <EmptyState
            icon={ShieldAlert}
            title="We can't show this profile"
            message="It may not exist, or you may no longer have access to it (access ends when a child turns 18)."
            actionLabel="Back to family"
            onAction={() => navigate('/patient/family')}
          />
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar name={child.name} size={56} />
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold text-ink truncate">{child.name}</h1>
                  <p className="text-sm text-slate">{formatAge(child.dateOfBirth)} old</p>
                </div>
              </div>
              <Link
                to={`/patient/family/${child.id}/calendar`}
                className="shrink-0 inline-flex items-center gap-1.5 bg-rose text-white rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-plum transition-colors"
              >
                <CalendarPlus size={16} /> Book
              </Link>
            </div>

            <div role="tablist" className="flex gap-1 bg-white rounded-xl p-1 mb-5 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    tab === t.id ? 'bg-rose text-white' : 'text-slate hover:text-ink'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'appointments' && <ChildAppointments child={child} />}
            {tab === 'messages' && <ChildMessages child={child} />}
            {tab === 'records' && <ChildRecords child={child} />}
            {tab === 'about' && <ChildAbout child={child} />}
          </>
        )}
      </div>
    </PatientLayout>
  )
}
