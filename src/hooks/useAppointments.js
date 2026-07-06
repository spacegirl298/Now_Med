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
} from '../firebase/firestore'

export function useAppointments() {
  const { currentUser, userRole } = useAuth()
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!currentUser) {
      setAppointments([]) // eslint-disable-line react-hooks/set-state-in-effect -- clearing local state on logout
      setLoading(false)
      return
    }

    setLoading(true)
    const onErr = (err) => {
      console.error('Appointments subscription error:', err)
      setError('Could not load appointments right now.')
      setLoading(false)
    }

    let unsubscribe
    if (userRole === 'secretary') {
      unsubscribe = subscribeToAllAppointments((data) => {
        setAppointments(data)
        setLoading(false)
      }, onErr)
    } else {
      unsubscribe = subscribeToPatientAppointments(currentUser.uid, (data) => {
        setAppointments(data)
        setLoading(false)
      }, onErr)
    }

    return () => unsubscribe && unsubscribe()
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
  }
}
