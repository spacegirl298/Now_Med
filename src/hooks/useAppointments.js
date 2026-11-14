// Real-time appointment data, scoped by role.
// Secretaries see every appointment; patients see only their own.
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  subscribeToAllAppointments,
  subscribeToPatientAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  cancelAppointment,
  markAppointmentDelay,
  markPatientLate,
} from '../firebase/firestore'

export function useAppointments() {
  const { currentUser, userRole } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!currentUser || !userRole) {
      setAppointments([]) // eslint-disable-line react-hooks/set-state-in-effect -- clear stale data when auth ends
      setLoading(false)
      return
    }

    setLoading(true)
    let cancelled = false
    let unsubscribe = null
    let retried = false

    const subscribe = () => {
      const onData = (data) => {
        // A good snapshot means whatever went wrong earlier has recovered, so
        // drop the banner (it used to stay on screen forever).
        setError('')
        setAppointments(data)
        setLoading(false)
      }

      const onErr = async (err) => {
        console.error('Appointments subscription error:', err)
        if (cancelled) return

        // A listener is dead after an error. The usual cause right after
        // sign-in is a stale ID token (e.g. an email_verified claim from
        // before verification), so refresh it and subscribe once more.
        if (!retried) {
          retried = true
          try {
            await currentUser.getIdToken(true)
            if (!cancelled) subscribe()
            return
          } catch {
            /* fall through to the message below */
          }
        }

        if (err?.code === 'permission-denied') {
          if (userRole === 'patient') {
            // A patient who has never booked simply has nothing to show.
            // That is a normal empty state, not something to alarm them about.
            setAppointments([])
            setError('')
          } else {
            setError(
              "Your staff access isn't active yet. Check that your email address has been approved by the practice and verified, then log in again.",
            )
          }
        } else {
          setError(
            userRole === 'secretary'
              ? 'Could not load appointments right now. Please refresh the page or try again in a moment. If it keeps happening, contact the practice IT Department.'
              : 'We could not load your appointments right now. Please check your connection and refresh in a moment.',
          )
        }
        setLoading(false)
      }

      if (unsubscribe) unsubscribe()
      unsubscribe =
        userRole === 'secretary'
          ? subscribeToAllAppointments(onData, onErr)
          : subscribeToPatientAppointments(currentUser.uid, onData, onErr)
    }

    subscribe()

    return () => {
      cancelled = true
      if (unsubscribe) unsubscribe()
    }
  }, [currentUser, userRole])

  return {
    appointments,
    loading,
    error,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    cancelAppointment,
    markAppointmentDelay,
    markPatientLate,
  }
}
