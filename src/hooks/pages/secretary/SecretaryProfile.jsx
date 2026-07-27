// Secretary's own profile, plus doctor profile management (should-have).
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { updateUserProfile, getUserById, getDoctorProfile, saveDoctorProfile } from '../../firebase/firestore'
import SecretaryLayout from './SecretaryLayout'
import BackButton from '../../components/BackButton'
import Card from '../../components/Card'
import Avatar from '../../components/Avatar'
import Button from '../../components/Button'
import { isValidName, isValidPhone } from '../../utils/validators'

export default function SecretaryProfile() {
  const { currentUser, userRole, userName, logout } = useAuth()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [signupInfo, setSignupInfo] = useState(null) // idNumber/idType
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMessage, setProfileMessage] = useState('')

  const [doctor, setDoctor] = useState({ name: '', bio: '', certifications: '', contact: '' })
  const [savingDoctor, setSavingDoctor] = useState(false)
  const [doctorMessage, setDoctorMessage] = useState('')

  useEffect(() => {
    if (!currentUser) return

    // currentUser.displayName is only set from this point forward for newly
    // registered accounts - userName (from the Firestore user doc, via
    // AuthContext) is the reliable source for everyone, including accounts
    // created before that fix.
    setName(currentUser.displayName || userName || '') // eslint-disable-line react-hooks/set-state-in-effect -- syncing local form state from the auth user

    getUserById(currentUser.uid).then(data => {
      if (!data) return
      setPhone(data.phone || '')
      setSignupInfo({
        idNumber: data.idNumber || '',
        idType: data.idType || '',
        email: data.email || currentUser.email || '',
      })
    })

    getDoctorProfile().then(data => {
      if (data) setDoctor(data)
    })
  }, [currentUser, userName])

  async function handleSaveProfile() {
    setProfileMessage('')
    if (!isValidName(name)) return setProfileMessage('Please enter a valid name.')
    if (!isValidPhone(phone)) return setProfileMessage('Please enter a valid phone number.')

    setSavingProfile(true)
    try {
      await updateUserProfile(currentUser.uid, { name, phone })
      setProfileMessage('Profile updated.')
    } catch {
      setProfileMessage('Could not save your profile. Please try again.')
    }
    setSavingProfile(false)
  }

  async function handleSaveDoctor() {
    setDoctorMessage('')
    setSavingDoctor(true)
    try {
      await saveDoctorProfile(doctor)
      setDoctorMessage('Doctor profile saved.')
    } catch (error) {
      console.error('Could not save doctor profile:', error)
      setDoctorMessage('Could not save the doctor profile. Please try again.')
    }
    setSavingDoctor(false)
  }

  return (
    <SecretaryLayout>
      <div className="p-6 md:p-8 max-w-2xl mx-auto flex flex-col gap-6">
        <BackButton />
        <h1 className="text-2xl font-semibold text-ink -mt-2">My Profile</h1>

        <Card>
          <div className="flex items-center gap-4 mb-5">
            <Avatar name={name || currentUser?.email} size={56} />
            <div>
              <p className="font-medium text-ink">{name || 'Secretary'}</p>
              <p className="text-sm text-slate">{currentUser?.email}</p>
              <p className="text-xs text-slate capitalize mt-1">{userRole}</p>
            </div>
          </div>

          {signupInfo && (
            <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
              <div className="bg-mist rounded-xl px-3 py-2">
                <p className="text-xs text-slate">ID / passport number</p>
                <p className="text-ink">{signupInfo.idNumber || '-'}</p>
              </div>
              <div className="bg-mist rounded-xl px-3 py-2">
                <p className="text-xs text-slate">ID type</p>
                <p className="text-ink">
                  {signupInfo.idType === 'sa_id' ? 'SA ID' : signupInfo.idType === 'passport' ? 'Passport' : '-'}
                </p>
              </div>
          
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-slate mb-1 block">Full name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate mb-1 block">Phone number</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="Optional"
                className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
              />
            </div>
            {profileMessage && <p className="text-sm text-slate">{profileMessage}</p>}
            <Button onClick={handleSaveProfile} disabled={savingProfile}>
              {savingProfile ? 'Saving...' : 'Save profile'}
            </Button>
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold text-ink mb-4">Doctor profile</h2>
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-xs text-slate mb-1 block">Doctor's name</label>
              <input
                value={doctor.name}
                onChange={e => setDoctor({ ...doctor, name: e.target.value })}
                placeholder="e.g. Dr. Nkosi"
                className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate mb-1 block">Certifications</label>
              <input
                value={doctor.certifications}
                onChange={e => setDoctor({ ...doctor, certifications: e.target.value })}
                placeholder="e.g. MBChB, HPCSA registered"
                className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate mb-1 block">Contact info</label>
              <input
                value={doctor.contact}
                onChange={e => setDoctor({ ...doctor, contact: e.target.value })}
                placeholder="Practice phone or email"
                className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate mb-1 block">Bio</label>
              <textarea
                value={doctor.bio}
                onChange={e => setDoctor({ ...doctor, bio: e.target.value })}
                rows={3}
                className="w-full border border-stone rounded-xl px-4 py-3 text-ink focus:border-rose focus:outline-none"
              />
            </div>
            {doctorMessage && <p className="text-sm text-slate">{doctorMessage}</p>}
            <Button onClick={handleSaveDoctor} disabled={savingDoctor}>
              {savingDoctor ? 'Saving...' : 'Save doctor profile'}
            </Button>
          </div>
        </Card>

        
      </div>
    </SecretaryLayout>
  )
}