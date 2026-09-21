// Live unread-message count for the nav badge.
//   patient   -> unread replies from the practice in their own chat
//   secretary -> total unread patient messages across every conversation
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { subscribeToConversation, subscribeToAllConversations } from '../firebase/firestore'

export function useUnreadMessages() {
  const { currentUser, userRole } = useAuth()
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!currentUser || !userRole) {
      setCount(0) // eslint-disable-line react-hooks/set-state-in-effect -- clearing local state on logout
      return
    }
    const onError = (err) => console.error('Unread message count failed:', err)
    if (userRole === 'patient') {
      return subscribeToConversation(
        currentUser.uid,
        (conversation) => setCount(conversation?.unreadForPatient || 0),
        onError,
      )
    }
    if (userRole === 'secretary') {
      return subscribeToAllConversations(
        (list) => setCount(list.reduce((sum, c) => sum + (c.unreadForStaff || 0), 0)),
        onError,
      )
    }
  }, [currentUser, userRole])

  return count
}