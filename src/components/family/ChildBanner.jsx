// Shown at the top of a child's record in the secretary's patient modal.
// It is where staff:
//   - see who the guardian is (to check the birth certificate or court order),
//   - confirm or refuse the guardian, which controls what the parent can see,
//   - and, once the child is 18, hand the record over to their own account.
// The child's status is read live, so it updates the moment staff act.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Modal from '../Modal'
import { getUserById } from '../../firebase/firestore'
import {
  subscribeToChild,
  setChildVerification,
  setChildIdNumber,
  handOverChild,
  RELATIONSHIPS,
} from '../../firebase/family'
import { ageOn, formatAge, MAJORITY_AGE, isValidSaIdChecksum, dobFromSaId } from '../../utils/childAge'
import { formatDisplayDate } from '../../utils/dateHelpers'

const STATUS = {
  verified: { label: 'Guardian confirmed', cls: 'bg-pastel-green text-green' },
  pending: { label: 'Awaiting confirmation', cls: 'bg-pastel-amber text-amber' },
  rejected: { label: 'Guardian not confirmed', cls: 'bg-pastel-red text-red' },
}

const smallButton =
  'rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50'

export default function ChildBanner({ child }) {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const [live, setLive] = useState(null)
  const [guardian, setGuardian] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmingHandOver, setConfirmingHandOver] = useState(false)
  const [result, setResult] = useState(null)
  const [idInput, setIdInput] = useState('')

  useEffect(() => {
    const unsub = subscribeToChild(child.id, setLive, (err) => console.error('Child status failed:', err))
    return () => unsub && unsub()
  }, [child.id])

  useEffect(() => {
    if (!child.primaryGuardianId) return
    getUserById(child.primaryGuardianId)
      .then(setGuardian)
      .catch((err) => console.error('Could not load the guardian:', err))
  }, [child.primaryGuardianId])

  const status = live?.verificationStatus || child.verificationStatus || 'pending'
  const idNumber = live?.idNumber ?? child.idNumber ?? ''
  const isAdult = child.dateOfBirth ? ageOn(child.dateOfBirth) >= MAJORITY_AGE : false
  const relationship =
    RELATIONSHIPS.find((r) => r.value === child.guardianRelationship)?.label || child.guardianRelationship

  async function decide(next) {
    setBusy(true)
    setError('')
    try {
      await setChildVerification(child.id, next, currentUser?.uid)
    } catch (err) {
      console.error(err)
      setError("Couldn't save that decision. Please try again.")
    }
    setBusy(false)
  }

  async function saveIdNumber() {
    const value = idInput.trim()
    if (!/^\d{13}$/.test(value) || !isValidSaIdChecksum(value)) {
      return setError('Please enter a valid 13-digit South African ID number.')
    }
    if (dobFromSaId(value) !== child.dateOfBirth) {
      return setError("That ID number doesn't match the date of birth on file.")
    }
    setBusy(true)
    setError('')
    try {
      await setChildIdNumber(child.id, 'sa_id', value)
      setIdInput('')
    } catch (err) {
      console.error(err)
      setError("Couldn't save the ID number. Please try again.")
    }
    setBusy(false)
  }

  async function runHandOver() {
    setBusy(true)
    setError('')
    try {
      const outcome = await handOverChild({ ...child, idNumber }, currentUser?.uid)
      setResult(outcome)
      setConfirmingHandOver(false)
    } catch (err) {
      console.error('Hand-over failed:', err)
      setError(
        ['not-adult', 'no-id', 'no-account', 'ambiguous', 'invalid'].includes(err.code)
          ? err.message
          : "The hand-over didn't finish. Nothing has been lost, so you can try again.",
      )
      setConfirmingHandOver(false)
    }
    setBusy(false)
  }

  const pill = STATUS[status] || STATUS.pending

  return (
    <div className="shrink-0 px-6 py-4 border-b border-sand bg-pastel-blue/40 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Heart size={16} className="text-rose shrink-0" />
        <p className="text-sm font-medium text-ink">
          Child · {child.dateOfBirth ? `${formatAge(child.dateOfBirth)} old, born ${formatDisplayDate(child.dateOfBirth)}` : 'date of birth missing'}
        </p>
        <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${pill.cls}`}>{pill.label}</span>
      </div>

      <p className="text-xs text-slate">
        Guardian:{' '}
        <span className="text-ink">
          {guardian?.name || child.guardianName || 'Unknown'}
          {relationship ? ` (${relationship})` : ''}
        </span>
        {guardian?.email ? ` · ${guardian.email}` : ''}
        {guardian?.phone ? ` · ${guardian.phone}` : ''}
        {guardian?.idNumber ? ` · ID ${guardian.idNumber}` : ''}
      </p>

      {!isAdult && (
        <div className="flex flex-wrap items-center gap-2">
          {status !== 'verified' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => decide('verified')}
              className={`${smallButton} bg-rose text-white hover:bg-plum`}
            >
              Confirm guardian
            </button>
          )}
          {status === 'pending' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => decide('rejected')}
              className={`${smallButton} border border-stone text-ink hover:border-rose`}
            >
              Can't confirm
            </button>
          )}
          {status !== 'pending' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => decide('pending')}
              className={`${smallButton} text-slate hover:text-ink underline`}
            >
              Undo
            </button>
          )}
          <p className="text-xs text-slate">
            {status === 'verified'
              ? "The parent can see this child's records (until they turn 12)."
              : status === 'rejected'
                ? 'The parent has lost access to this child.'
                : 'Check the birth certificate or court order before confirming.'}
          </p>
        </div>
      )}

      {isAdult && !result && (
        <div className="rounded-xl bg-white p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-ink">This patient is now 18</p>
          <p className="text-xs text-slate">
            Their parent no longer has access. Hand the record over to their own Now Med account:
            appointments, records, profile and chat history move across.
          </p>
          {!idNumber && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={idInput}
                onChange={(e) => setIdInput(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                maxLength={13}
                placeholder="Their 13-digit ID number"
                className="flex-1 min-w-48 border border-stone rounded-xl px-3 py-2 text-sm text-ink focus:border-rose focus:outline-none"
              />
              <button
                type="button"
                disabled={busy}
                onClick={saveIdNumber}
                className={`${smallButton} border border-stone text-ink hover:border-rose`}
              >
                Save ID number
              </button>
            </div>
          )}
          <div>
            <button
              type="button"
              disabled={busy || !idNumber}
              onClick={() => setConfirmingHandOver(true)}
              className={`${smallButton} bg-rose text-white hover:bg-plum`}
            >
              Hand over to their account
            </button>
          </div>
        </div>
      )}

      {result && (
        <div role="status" className="rounded-xl bg-pastel-green text-green p-4 text-sm flex flex-col gap-2">
          <p className="font-medium">Handed over{result.adultName ? ` to ${result.adultName}` : ''}.</p>
          <p className="text-xs">
            Moved {result.moved.appointments} appointment{result.moved.appointments === 1 ? '' : 's'},{' '}
            {result.moved.records} record{result.moved.records === 1 ? '' : 's'},{' '}
            {result.moved.messages} message{result.moved.messages === 1 ? '' : 's'}
            {result.moved.profile ? ' and their profile' : ''}.
          </p>
          <div>
            <button
              type="button"
              onClick={() => navigate('/secretary/patients', { state: { openPatientId: result.adultId } })}
              className={`${smallButton} bg-green text-white hover:opacity-90`}
            >
              Open their record
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-red bg-pastel-red rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <Modal
        isOpen={confirmingHandOver}
        onClose={() => !busy && setConfirmingHandOver(false)}
        title="Hand over this record?"
        confirmLabel={busy ? 'Handing over...' : 'Hand over'}
        confirmDisabled={busy}
        onConfirm={runHandOver}
      >
        <p className="text-sm text-slate">
          This moves everything for {child.name} to the Now Med account that uses ID number{' '}
          <span className="text-ink">{idNumber}</span>. Please check that account belongs to{' '}
          {child.firstName || 'them'} first. You can't point it at a different account afterwards.
        </p>
      </Modal>
    </div>
  )
}
