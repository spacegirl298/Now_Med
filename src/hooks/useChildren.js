// Live list of the children the signed-in patient manages as a guardian.
// Only subscribes for the patient role; staff and signed-out users get [].
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { subscribeToMyChildren } from '../firebase/family'
import { isManageable } from '../utils/childAge'

export function useChildren() {
  const { currentUser, userRole } = useAuth()
  const [children, setChildren] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!currentUser || userRole !== 'patient') {
      setChildren([]) // eslint-disable-line react-hooks/set-state-in-effect -- clear stale data when auth ends
      setLoading(false)
      return
    }
    setLoading(true)
    const unsubscribe = subscribeToMyChildren(
      currentUser.uid,
      (list) => {
        setError('')
        // Once a child turns 18 the parent's access ends, so they drop out of
        // the list even before the database rules stop returning them.
        setChildren(list.filter((c) => isManageable(c)))
        setLoading(false)
      },
      (err) => {
        console.error('Could not load family profiles:', err)
        setError("We couldn't load your family profiles. Please check your connection and try again.")
        setLoading(false)
      },
    )
    return () => unsubscribe && unsubscribe()
  }, [currentUser, userRole])

  return { children, loading, error }
}