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