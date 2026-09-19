// First-Time Patient Intake Form (PRD: must-have).
//
// Shown once, on a patient's first login only. Captures the same
// admin/contact fields PatientRecords.jsx lets a patient self-edit later
// (occupation, marital status, emergency contact, medical aid) — these are
// exactly the fields patientProfiles' Firestore rules allow a patient to
// write via savePatientProfile's patientEditableProfileFields() allowlist.
// Clinical fields (allergies, medications, chronic conditions, etc.) are
// intentionally NOT collected here — those stay secretary-entered, per the
// existing rules and PatientRecords.jsx comments.
//
// Gating: AuthContext exposes hasCompletedIntake (read from the user doc at
// login) and completeIntake(). App.jsx's RequireIntake wrapper redirects any
// patient with hasCompletedIntake === false here before they can reach any
// other patient route. On submit we save the profile fields AND flip
// hasCompletedIntake to true on the user doc, then navigate to the
// dashboard.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { savePatientProfile, getPatientProfile } from '../../firebase/firestore'
import Card from '../../components/Card'
import Button from '../../components/Button'
import { isValidPhone, isValidMedicalAidNumber } from '../../utils/validators'

const EMPTY_FORM = {
  occupation: '',
  maritalStatus: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  medicalAidProvider: '',
  medicalAidNumber: '',
}

const inputClasses =
  'w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none'

export default function PatientIntake() {
  const { currentUser, userName, completeIntake } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate() {
    const errors = {}
    if (!isValidPhone(form.emergencyContactPhone)) {
      errors.emergencyContactPhone = 'Numbers only, 7–15 digits.'
    }
    if (!isValidMedicalAidNumber(form.medicalAidNumber)) {
      errors.medicalAidNumber = 'Numbers only.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!validate()) return

    setSaving(true)
    try {
      // A secretary may already have created a profile doc for this patient
      // by ID number (walk-in) before they registered — linkPatientDataByIdNumber
      // in AuthContext already attaches it to this uid, so check for an
      // existing profile first rather than always creating a new one.
      const existing = await getPatientProfile(currentUser.uid)
      await savePatientProfile({
        profileId: existing?.id || null,
        patientId: currentUser.uid,
        ...form,
      })
      await completeIntake()
      navigate('/patient/dashboard')
    } catch (err) {
      console.error(err)
      setError(
        err?.code === 'permission-denied'
          ? "You don't have permission to save these details. Please contact the practice."
          : 'Could not save your details. Please try again.',
      )
    }
    setSaving(false)
  }

  async function handleSkip() {
    // Still lets them into the app — intake can be completed later from
    // My Profile / Medical Records — but only ever shown automatically once.
    setSaving(true)
    try {
      await completeIntake()
      navigate('/patient/dashboard')
    } catch (err) {
      console.error(err)
    }
    setSaving(false)
  }

  return (
    <div className="min-h-screen bg-mist flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <Card>
          <h1 className="text-2xl font-semibold text-ink mb-1">
            Welcome{userName ? `, ${userName}` : ''}!
          </h1>
          <p className="text-sm text-slate mb-6">
            Before you get started, help us fill in a few details for your
            record. You can update these anytime from your profile.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate mb-1 block">
                  Marital status
                </label>
                <input
                  value={form.maritalStatus}
                  onChange={(e) => setField('maritalStatus', e.target.value)}
                  className={inputClasses}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="text-xs text-slate mb-1 block">
                  Occupation
                </label>
                <input
                  value={form.occupation}
                  onChange={(e) => setField('occupation', e.target.value)}
                  className={inputClasses}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="border-t border-stone pt-4">
              <p className="text-sm font-medium text-ink mb-3">
                Emergency contact
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate mb-1 block">
                    Contact name
                  </label>
                  <input
                    value={form.emergencyContactName}
                    onChange={(e) =>
                      setField('emergencyContactName', e.target.value)
                    }
                    className={inputClasses}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">
                    Contact phone
                  </label>
                  <input
                    value={form.emergencyContactPhone}
                    onChange={(e) =>
                      setField('emergencyContactPhone', e.target.value)
                    }
                    className={`${inputClasses} ${
                      fieldErrors.emergencyContactPhone ? 'border-red' : ''
                    }`}
                  />
                  {fieldErrors.emergencyContactPhone && (
                    <p className="text-red text-xs mt-1">
                      {fieldErrors.emergencyContactPhone}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-stone pt-4">
              <p className="text-sm font-medium text-ink mb-3">Medical aid</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate mb-1 block">
                    Provider
                  </label>
                  <input
                    value={form.medicalAidProvider}
                    onChange={(e) =>
                      setField('medicalAidProvider', e.target.value)
                    }
                    className={inputClasses}
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate mb-1 block">
                    Member number
                  </label>
                  <input
                    value={form.medicalAidNumber}
                    onChange={(e) =>
                      setField('medicalAidNumber', e.target.value)
                    }
                    className={`${inputClasses} ${
                      fieldErrors.medicalAidNumber ? 'border-red' : ''
                    }`}
                    placeholder="Optional"
                  />
                  {fieldErrors.medicalAidNumber && (
                    <p className="text-red text-xs mt-1">
                      {fieldErrors.medicalAidNumber}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red">{error}</p>}

            <div className="flex gap-3 mt-2">
              <Button type="submit" disabled={saving} className="flex-1">
                {saving ? 'Saving...' : 'Save and continue'}
              </Button>
              <button
                type="button"
                onClick={handleSkip}
                disabled={saving}
                className="text-sm text-slate underline px-2"
              >
                Skip for now
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
