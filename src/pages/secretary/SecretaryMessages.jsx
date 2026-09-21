// Secretary inbox: every patient conversation, plus search to start a new
// one with any registered patient. Reminders sent from the schedule show up
// in the same thread. Walk-in patients without an account have no chat (there
// is nobody to receive it) - contact them by phone instead.
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, MessageSquare, Search } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  subscribeToAllConversations,
  subscribeToPatients,
  subscribeToMessages,
  sendMessage,
  markConversationRead,
  markMessageNotificationsRead,
} from '../../firebase/firestore'
import SecretaryLayout from './SecretaryLayout'
import ChatThread from '../../components/ChatThread'
import Avatar from '../../components/Avatar'
import { formatTimeAgo } from '../../utils/dateHelpers'

export default function SecretaryMessages() {
  const { currentUser, userName } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [conversations, setConversations] = useState([])
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  // Deep-linked from a patient's record ("Message" button).
  const [activeId, setActiveId] = useState(location.state?.patientId || null)
  const [messages, setMessages] = useState([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const onError = (err) => {
      console.error(err)
      setLoadError('Could not load messages. Check the browser console for the Firestore error.')
    }
    const unsubConversations = subscribeToAllConversations(setConversations, onError)
    const unsubPatients = subscribeToPatients(setPatients)
    return () => {
      unsubConversations && unsubConversations()
      unsubPatients && unsubPatients()
    }
  }, [])

  useEffect(() => {
    if (!activeId) return
    setLoadingMessages(true) // eslint-disable-line react-hooks/set-state-in-effect -- resetting when the open chat changes
    setMessages([])
    const unsub = subscribeToMessages(
      activeId,
      (list) => {
        setMessages(list)
        setLoadingMessages(false)
      },
      (err) => {
        console.error(err)
        setLoadingMessages(false)
      },
    )
    return () => unsub && unsub()
  }, [activeId])

  const patientById = useMemo(() => Object.fromEntries(patients.map((p) => [p.id, p])), [patients])

  const activeConversation = conversations.find((c) => c.id === activeId)
  const activeUnread = activeConversation?.unreadForStaff || 0
  useEffect(() => {
    if (!activeId) return
    if (activeUnread > 0) markConversationRead(activeId, 'secretary').catch(console.error)
    if (currentUser?.uid) markMessageNotificationsRead(currentUser.uid, activeId).catch(console.error)
  }, [activeId, activeUnread, currentUser])

  const listItems = useMemo(() => {
    const term = search.trim().toLowerCase()
    // Conversations already arrive sorted by most recent activity
    // (subscribeToAllConversations); bubble the ones with unread patient
    // messages to the very top of that so a secretary juggling a busy
    // inbox sees what actually needs a reply first, without losing the
    // recency order within each group.
    const items = conversations
      .map((c) => ({
        id: c.id,
        name: c.patientName || patientById[c.id]?.name || 'Patient',
        last: c.lastMessage || '',
        at: c.lastMessageAt,
        unread: c.unreadForStaff || 0,
      }))
      .sort((a, b) => (b.unread > 0) - (a.unread > 0))
    if (!term) return items

    const withChat = new Set(items.map((i) => i.id))
    const matchingChats = items.filter((i) => i.name.toLowerCase().includes(term))
    const newChats = patients
      .filter(
        (p) =>
          !withChat.has(p.id) &&
          ((p.name || '').toLowerCase().includes(term) ||
            (p.email || '').toLowerCase().includes(term) ||
            (p.idNumber || '').toLowerCase().includes(term)),
      )
      .map((p) => ({ id: p.id, name: p.name || 'Unnamed patient', last: 'Start a conversation', at: null, unread: 0 }))
    return [...matchingChats, ...newChats]
  }, [conversations, patients, patientById, search])

  const activeName =
    activeConversation?.patientName || patientById[activeId]?.name || 'Patient'

  function handleSend(text) {
    return sendMessage({
      patientId: activeId,
      patientName: activeName,
      senderRole: 'secretary',
      senderName: userName || 'Practice',
      text,
      notify: true, // also shows in the patient's notification bell
    })
  }

  function openPatientRecord() {
    navigate('/secretary/patients', { state: { openPatientId: activeId } })
  }

  return (
    <SecretaryLayout>
      <div className="h-[calc(100dvh-5rem)] md:h-screen md:grid md:grid-cols-[320px_1fr]">
        {/* Conversation list */}
        <aside
          className={`${activeId ? 'hidden md:flex' : 'flex'} flex-col min-h-0 h-full bg-white border-r border-sand`}
        >
          <div className="p-4 border-b border-sand">
            <h1 className="text-xl font-semibold text-ink mb-3">Messages</h1>
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or start a chat..."
                className="w-full border border-stone rounded-xl pl-9 pr-3 py-2.5 text-sm text-ink focus:border-rose focus:outline-none"
              />
            </div>
          </div>

          {loadError && <p className="text-xs text-red px-4 py-3">{loadError}</p>}

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-sand">
            {listItems.length === 0 ? (
              <p className="text-sm text-slate text-center px-6 py-10">
                {search ? 'No registered patients match that search.' : 'No conversations yet. Search for a patient to start one.'}
              </p>
            ) : (
              listItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveId(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-mist transition-colors ${
                    item.id === activeId ? 'bg-mist' : ''
                  }`}
                >
                  <Avatar name={item.name} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-ink truncate">{item.name}</p>
                      {item.at && <p className="text-[11px] text-slate shrink-0">{formatTimeAgo(item.at)}</p>}
                    </div>
                    <p className={`text-xs truncate ${item.unread ? 'text-ink font-medium' : 'text-slate'}`}>
                      {item.last}
                    </p>
                  </div>
                  {item.unread > 0 && (
                    <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-rose text-white text-[11px] font-medium flex items-center justify-center">
                      {item.unread}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          <p className="text-[11px] text-slate px-4 py-3 border-t border-sand">
            Walk-in patients without an account can't be messaged here - use their phone number.
          </p>
        </aside>

        {/* Thread */}
        <section className={`${activeId ? 'flex' : 'hidden md:flex'} flex-col min-h-0 h-full bg-mist`}>
          {activeId ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-sand">
                <button
                  onClick={() => setActiveId(null)}
                  aria-label="Back to conversations"
                  className="md:hidden text-slate hover:text-ink"
                >
                  <ArrowLeft size={20} />
                </button>
                <Avatar name={activeName} size={36} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">{activeName}</p>
                  {patientById[activeId]?.phone && (
                    <p className="text-xs text-slate">{patientById[activeId].phone}</p>
                  )}
                </div>
                <button
                  onClick={openPatientRecord}
                  aria-label={`View ${activeName}'s medical record`}
                  title="View medical record"
                  className="ml-auto shrink-0 text-slate hover:text-rose"
                >
                  <FileText size={20} />
                </button>
              </div>
              <div className="flex-1 min-h-0">
                <ChatThread
                  messages={messages}
                  myRole="secretary"
                  loading={loadingMessages}
                  onSend={handleSend}
                  showModerationFlags
                  emptyMessage="No messages yet. Say hello below."
                  placeholder={`Message ${activeName}...`}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
              <MessageSquare size={32} className="text-slate mb-3" />
              <p className="text-sm text-slate">Pick a conversation, or search for a patient to start one.</p>
            </div>
          )}
        </section>
      </div>
    </SecretaryLayout>
  )
}