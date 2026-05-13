import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function SignUp() {
  const [step, setStep] = useState(1)
  const [role, setRole] = useState('')
  const [formData, setFormData] = useState({
    name: '', email: '', password: '', practiceCode: '', agreedToTerms: false
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { register } = useAuth()
  const navigate = useNavigate()

  // STEP 1 — Role selection
  if (step === 1) return (
    <div className="min-h-screen bg-mist flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-semibold text-ink mb-2">Create your account</h1>
      <p className="text-slate text-sm mb-8">Who are you signing up as?</p>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        <button
          onClick={() => { setRole('patient'); setStep(2) }}
          className="bg-white border-2 border-sand rounded-2xl p-6 text-left hover:border-rose transition-colors"
        >
          <p className="font-semibold text-ink">Patient</p>
          <p className="text-sm text-slate mt-1">Book appointments and view your records</p>
        </button>

        <button
          onClick={() => { setRole('secretary'); setStep(2) }}
          className="bg-white border-2 border-sand rounded-2xl p-6 text-left hover:border-rose transition-colors"
        >
          <p className="font-semibold text-ink">Medical Secretary</p>
          <p className="text-sm text-slate mt-1">Manage appointments and patient records</p>
        </button>
      </div>
    </div>
  )

  // STEP 2 — Details form
  async function handleSubmit() {
    if (role === 'secretary' && !formData.agreedToTerms) {
      return setError('You must agree to the terms')
    }
    if (role === 'secretary' && !formData.practiceCode) {
      return setError('Practice code is required')
    }

    setLoading(true)
    setError('')

    try {
      await register(
        formData.email,
        formData.password,
        role,
        formData.name,
        formData.practiceCode
      )
      setStep(3)
    } catch (err) {
      setError(err.message)
    }

    setLoading(false)
  }

  if (step === 2) return (
    <div className="min-h-screen bg-mist flex flex-col items-center justify-center p-6">
      {/* Progress bar */}
      <div className="w-full max-w-sm mb-8">
        <div className="flex gap-2">
          <div className="h-1 flex-1 rounded-full bg-rose" />
          <div className="h-1 flex-1 rounded-full bg-rose" />
          <div className="h-1 flex-1 rounded-full bg-sand" />
        </div>
        <p className="text-xs text-slate mt-2">Step 2 of 3 — Your details</p>
      </div>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <input
          placeholder="Full name"
          value={formData.name}
          onChange={e => setFormData({...formData, name: e.target.value})}
          className="border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
        />
        <input
          placeholder="Email address"
          type="email"
          value={formData.email}
          onChange={e => setFormData({...formData, email: e.target.value})}
          className="border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
        />
        <input
          placeholder="Password"
          type="password"
          value={formData.password}
          onChange={e => setFormData({...formData, password: e.target.value})}
          className="border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
        />

        {/* Secretary-only fields */}
        {role === 'secretary' && (
          <>
            <input
              placeholder="Practice code (e.g. NM001)"
              value={formData.practiceCode}
              onChange={e => setFormData({...formData, practiceCode: e.target.value})}
              className="border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
            />
            <label className="flex items-center gap-3 text-sm text-slate">
              <input
                type="checkbox"
                checked={formData.agreedToTerms}
                onChange={e => setFormData({...formData, agreedToTerms: e.target.checked})}
              />
              I confirm I am an authorised medical secretary
            </label>
          </>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="bg-rose text-white rounded-xl py-3 font-medium hover:bg-plum transition-colors disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Continue'}
        </button>

        <button onClick={() => setStep(1)} className="text-sm text-slate text-center">
          ← Back
        </button>
      </div>
    </div>
  )

  // STEP 3 — Email verification
  if (step === 3) return (
    <div className="min-h-screen bg-mist flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm mb-8">
        <div className="flex gap-2">
          <div className="h-1 flex-1 rounded-full bg-rose" />
          <div className="h-1 flex-1 rounded-full bg-rose" />
          <div className="h-1 flex-1 rounded-full bg-rose" />
        </div>
        <p className="text-xs text-slate mt-2">Step 3 of 3 — Verify your email</p>
      </div>

      <h2 className="text-xl font-semibold text-ink mb-2">Check your email</h2>
      <p className="text-slate text-sm text-center mb-8">
        We sent a verification link to <strong>{formData.email}</strong>. 
        Click the link in that email to activate your account.
      </p>

      <button
        onClick={() => navigate('/login')}
        className="bg-rose text-white rounded-xl px-8 py-3 font-medium hover:bg-plum transition-colors"
      >
        Go to Login
      </button>
    </div>
  )
}