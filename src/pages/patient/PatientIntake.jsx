import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  saveIntakeForm,
  savePatientProfile,
  getPatientProfile,
  getIntakeForm,
} from '../../firebase/firestore'
import IntakeWizard from '../../components/IntakeWizard'
import { PROFILE_SYNC_FIELDS } from '../../utils/intakeQuestions'

export default function PatientIntake() {
  const { currentUser, userName, userIdNumber, intakeCompleted, completeIntake, deferIntake } =
    useAuth()
  const navigate = useNavigate()

  if (intakeCompleted) return <Navigate to="/patient/dashboard" replace />

  async function handleLater() {
    await deferIntake()
    navigate('/patient/dashboard')
  }

  async function handleSubmit(clean) {
    const existing = await getIntakeForm(currentUser.uid)
    if (!existing) {
      await saveIntakeForm({
        patientId: currentUser.uid,
        patientIdNumber: userIdNumber,
        answers: clean,
        submittedBy: 'patient',
      })
    }

    const profileFields = {}
    PROFILE_SYNC_FIELDS.forEach((k) => {
      if (clean[k]) profileFields[k] = clean[k]
    })
    if (Object.keys(profileFields).length > 0) {
      try {
        const profile = await getPatientProfile(currentUser.uid)
        await savePatientProfile({
          profileId: profile?.id || null,
          patientId: currentUser.uid,
          patientIdNumber: userIdNumber,
          ...profileFields,
        })
      } catch (err) {
        console.error('Intake saved, but profile fields could not be copied:', err)
      }
    }

    await completeIntake()
    navigate('/patient/dashboard')
  }

  return (
    <IntakeWizard
      intro={{
        eyebrow: 'Your first visit',
        title: `Welcome${userName ? `, ${userName}` : ''}`,
        lead: 'Let’s build a clear picture of your health before you meet the practice.',
        body: 'You’ll answer one focused question at a time. Required questions are marked with an asterisk; optional questions can be skipped and completed later.',
      }}
      onLater={handleLater}
      onSubmit={handleSubmit}
    />
  )
}
