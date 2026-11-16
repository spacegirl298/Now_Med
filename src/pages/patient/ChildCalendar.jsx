// /patient/family/:childId/calendar
// Loads and checks the child, then shows the existing booking calendar with
// that child as the patient. The calendar itself is unchanged for everyone
// else: it only switches behaviour when it is handed a `forChild`.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { subscribeToChild } from '../../firebase/family'
import { isManageable } from '../../utils/childAge'
import PatientLayout from './PatientLayout'
import PatientCalendar from './PatientCalendar'
import EmptyState from '../../components/EmptyState'

export default function ChildCalendar() {
  const { childId } = useParams()
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [child, setChild] = useState(undefined) // undefined = loading, null = unavailable

  useEffect(() => {
    const unsub = subscribeToChild(childId, setChild, (err) => {
      console.error('Could not load child profile:', err)
      setChild(null)
    })
    return () => unsub && unsub()
  }, [childId])

  if (child === undefined) {
    return (
      <PatientLayout>
        <p className="text-sm text-slate text-center py-16">Loading...</p>
      </PatientLayout>
    )
  }

  const allowed =
    child &&
    child.guardianIds?.includes(currentUser?.uid) &&
    isManageable(child) &&
    child.verificationStatus !== 'rejected'
  if (!allowed) {
    return (
      <PatientLayout>
        <div className="p-4 sm:p-6 md:p-8 max-w-3xl mx-auto">
          <EmptyState
            icon={ShieldAlert}
            title="We can't book for this profile"
            message="It may not exist, or you may no longer have access to it."
            actionLabel="Back to family"
            onAction={() => navigate('/patient/family')}
          />
        </div>
      </PatientLayout>
    )
  }

  return <PatientCalendar forChild={child} />
}
