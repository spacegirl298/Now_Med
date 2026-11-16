// "Add a child" form, shown in a modal on the Family page.
// Collects the minimum needed to create a managed profile and asks the parent
// to confirm they are authorised to manage the child's health information.
import { useState } from 'react'
import Modal from '../Modal'
import { useAuth } from '../../context/AuthContext'
import { addChild, RELATIONSHIPS, CHILD_ID_TYPES } from '../../firebase/family'
import { isValidName } from '../../utils/validators'
import { getTodayString } from '../../utils/dateHelpers'
import { ageOn, dobFromSaId, isValidSaIdChecksum, MAJORITY_AGE } from '../../utils/childAge'

const fieldClass =
  'w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none bg-white'

const EMPTY = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  relationship: 'mother',
  idType: 'none',
  idNumber: '',
  consent: false,
}

function validate(f) {
  if (!isValidName(f.firstName) || !isValidName(f.lastName)) {
    return "Please enter the child's first and last name."
  }
  if (!f.dateOfBirth) return "Please enter the child's date of birth."
  if (f.dateOfBirth > getTodayString()) return 'Date of birth cannot be in the future.'
  if (ageOn(f.dateOfBirth) >= MAJORITY_AGE) {
    return 'People who are 18 or older need their own Now Med account.'
  }
  const id = f.idNumber.trim()
  if (f.idType === 'sa_id') {
    if (!/^\d{13}$/.test(id)) return 'Please enter a valid 13-digit South African ID number.'
    if (!isValidSaIdChecksum(id)) return "That ID number doesn't look right. Please check it."
    if (dobFromSaId(id) !== f.dateOfBirth) {
      return "The ID number doesn't match the date of birth you entered."
    }
  }
  if (f.idType === 'birth_certificate' && !/^[A-Za-z0-9/-]{5,25}$/.test(id)) {
    return 'Please enter a valid birth certificate number.'
  }
  if (!f.consent) {
    return "Please confirm you're allowed to manage this child's health information."
  }
  return ''
}

export default function AddChildModal({ isOpen, onClose, onCreated }) {
  const { currentUser, userName } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  function handleClose() {
    if (saving) return
    setForm(EMPTY)
    setError('')
    onClose()
  }

  async function handleSave() {
    const problem = validate(form)
    if (problem) return setError(problem)

    setSaving(true)
    setError('')
    try {
      const childId = await addChild({
        guardian: { uid: currentUser.uid, name: userName || currentUser.displayName || '' },
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth,
        relationship: form.relationship,
        idType: form.idType,
        idNumber: form.idType === 'none' ? '' : form.idNumber,
      })
      setForm(EMPTY)
      onCreated(childId)
    } catch (err) {
      console.error('Could not add child:', err)
      setError(
        err?.code === 'permission-denied'
          ? "We couldn't save this profile. Family profiles may not be switched on for this practice yet."
          : "We couldn't save this profile. Please try again.",
      )
    }
    setSaving(false)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add a child"
      confirmLabel={saving ? 'Saving...' : 'Add child'}
      confirmDisabled={saving}
      onConfirm={handleSave}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate mb-1 block">First name</label>
            <input value={form.firstName} onChange={set('firstName')} autoComplete="off" className={fieldClass} />
          </div>
          <div>
            <label className="text-xs text-slate mb-1 block">Last name</label>
            <input value={form.lastName} onChange={set('lastName')} autoComplete="off" className={fieldClass} />
          </div>
        </div>

        <div>
          <label className="text-xs text-slate mb-1 block">Date of birth</label>
          <input
            type="date"
            value={form.dateOfBirth}
            max={getTodayString()}
            onChange={set('dateOfBirth')}
            className={fieldClass}
          />
        </div>

        <div>
          <label className="text-xs text-slate mb-1 block">Your relationship to the child</label>
          <select value={form.relationship} onChange={set('relationship')} className={fieldClass}>
            {RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs text-slate mb-1 block">Identity document</label>
          <select
            value={form.idType}
            onChange={(e) => setForm({ ...form, idType: e.target.value, idNumber: '' })}
            className={fieldClass}
          >
            {CHILD_ID_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {form.idType !== 'none' && (
            <input
              value={form.idNumber}
              onChange={(e) =>
                setForm({
                  ...form,
                  idNumber: form.idType === 'sa_id' ? e.target.value.replace(/\D/g, '') : e.target.value,
                })
              }
              inputMode={form.idType === 'sa_id' ? 'numeric' : 'text'}
              maxLength={form.idType === 'sa_id' ? 13 : 25}
              placeholder={form.idType === 'sa_id' ? '13-digit ID number' : 'Birth certificate number'}
              className={`${fieldClass} mt-2`}
            />
          )}
          <p className="text-xs text-slate mt-1.5">
            The ID number is used to hand the account over to your child when they turn 18.
            You can add it later.
          </p>
        </div>

        <label className="flex items-start gap-2.5 text-sm text-slate cursor-pointer">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => setForm({ ...form, consent: e.target.checked })}
            className="accent-rose mt-0.5"
          />
          I am this child's parent or legal guardian, and I'm allowed to manage their health
          information. The practice may ask for proof.
        </label>

        {error && (
          <p role="alert" className="text-sm text-red bg-pastel-red rounded-xl px-4 py-3">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}
