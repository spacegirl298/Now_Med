// First-Time Patient Intake Form (PRD: must-have).
//
// The question-by-question wizard itself lives in components/IntakeWizard.jsx
// (shared with the parent-completes-for-a-child flow in ChildIntake.jsx).
// This page is the adult's own version: it decides where the answers go.
//   1. On first login AuthContext checks whether an intake form already
//      exists for this patient (by uid or ID number). If not, RequireIntake
//      (App.jsx) sends them here.
//   2. "Do this later" is available on every screen. It marks the prompt as
//      seen (deferIntake) and drops them on the dashboard, where a floating
//      form button (IntakeFormButton) brings them back until it's finished.
//   3. On submit the full answers are saved to `intakeForms` (visible to the
//      secretary on the patient's record) and the six non-clinical fields
//      patients are allowed to write are also copied onto their profile.
//      Clinical answers are NOT written to patientProfiles - patients can't
//      edit those; a secretary reviews and imports them.
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

  // Already done (e.g. deep-linked back here) - nothing to fill in.
  if (intakeCompleted) return <Navigate to="/patient/dashboard" replace />

  async function handleLater() {
    await deferIntake()
    navigate('/patient/dashboard')
  }

  async function handleSubmit(clean) {
    // Patient rules allow a query for the authenticated patient's UID, but
    // may not allow an ID-number query across the whole intakeForms
    // collection. Any pre-registration form is linked during authentication,
    // so the UID lookup is the correct double-submit guard here.
    const existing = await getIntakeForm(currentUser.uid)
    if (!existing) {
      await saveIntakeForm({
        patientId: currentUser.uid,
        patientIdNumber: userIdNumber,
        answers: clean,
        submittedBy: 'patient',
      })
    }

    // Copy the non-clinical fields patients may write onto their profile.
    // Only non-empty answers, so we never blank out something a secretary
    // already entered for a walk-in. A failure here must not lose the form.
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
