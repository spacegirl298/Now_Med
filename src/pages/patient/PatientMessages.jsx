// Patient <-> practice chat. One conversation per patient; any secretary can
// read and reply. Reminders the secretary sends from the schedule also land
// here (marked as reminders) as well as in the notification bell.
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  subscribeToMessages,
  subscribeToConversation,
  sendMessage,
  markConversationRead,
  markChatNotificationsRead,
} from '../../firebase/firestore'
import PatientLayout from './PatientLayout'
import ChatThread from '../../components/ChatThread'

export default function PatientMessages() {
  const { currentUser, userName } = useAuth()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [conversation, setConversation] = useState(null)

  useEffect(() => {
    if (!currentUser) return
    const onError = (err) => {
      console.error(err)
      setLoadError('Could not load your messages. Please try again or contact the practice.')
      setLoading(false)
    }
    const unsubMessages = subscribeToMessages(
      currentUser.uid,
      (list) => {
        setMessages(list)
        setLoading(false)
      },
      onError,
    )
    const unsubConversation = subscribeToConversation(currentUser.uid, setConversation, onError)
    return () => {
      unsubMessages && unsubMessages()
      unsubConversation && unsubConversation()
    }
  }, [currentUser])

  // Anything that arrives while this page is open counts as read.
  const unread = conversation?.unreadForPatient || 0
  useEffect(() => {
    if (currentUser && unread > 0) {
      markConversationRead(currentUser.uid, 'patient').catch(console.error)
    }
  }, [currentUser, unread])

  // Clears the bell notification for any message/reminder that brought the
  // patient here in the first place - just resetting unreadForPatient above
  // clears the Messages nav badge, but the bell dropdown reads a separate
  // `notifications` collection and won't clear on its own otherwise.
  useEffect(() => {
    if (currentUser) {
      markChatNotificationsRead(currentUser.uid).catch(console.error)
    }
  }, [currentUser])

  function handleSend(text) {
    return sendMessage({
      patientId: currentUser.uid,
      patientName: userName || '',
      senderRole: 'patient',
      senderName: userName || 'Patient',
      text,
    })
  }

  return (
    <PatientLayout>
      <div className="flex flex-col h-[calc(100dvh-5rem)] md:h-screen max-w-3xl mx-auto w-full">
        <div className="px-6 md:px-8 pt-6 pb-4">
          <h1 className="text-2xl font-semibold text-ink mb-1">Messages</h1>
          <p className="text-slate text-sm">
            Chat with the practice. For anything urgent, call the practice or
            emergency services instead of waiting for a reply here.
          </p>
        </div>

        {loadError && (
          <div className="bg-pastel-red text-red text-sm rounded-xl px-4 py-3 mx-6 md:mx-8 mb-3">
            {loadError}
          </div>
        )}

        <div className="flex-1 min-h-0 mx-4 md:mx-8 mb-4 bg-mist rounded-2xl overflow-hidden">
          <ChatThread
            messages={messages}
            myRole="patient"
            loading={loading}
            onSend={handleSend}
            emptyMessage="No messages yet. Send the practice a message to get started."
            placeholder="Message the practice..."
          />
        </div>
      </div>
    </PatientLayout>
  )
}