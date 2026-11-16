import { createContext, useContext, useEffect, useState } from 'react'
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import SplashScreen from '../components/SplashScreen'
import {
  linkPatientDataByIdNumber,
  getIntakeFormForPatient,
  linkIntakeFormToPatient,
  reserveIdNumberIndexSlot,
} from '../firebase/firestore'


const AuthContext = createContext()


// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [userName, setUserName] = useState(null)
  const [userIdNumber, setUserIdNumber] = useState('')
  const [intakeCompleted, setIntakeCompleted] = useState(undefined)
  const [intakeDeferred, setIntakeDeferred] = useState(undefined)
  const [loading, setLoading] = useState(true)
  const [splashDone, setSplashDone] = useState(() => {
    try {
      return sessionStorage.getItem('nowmedSplashSeen') === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (splashDone) return
    const id = setTimeout(() => {
      try {
        sessionStorage.setItem('nowmedSplashSeen', '1')
      } catch {
        // Storage is optional.
      }
      setSplashDone(true)
    }, 3800)
    return () => clearTimeout(id)
  }, [splashDone])

  // Register a new user
  async function register(email, password, idNumber, idType, role, name) {
    const result = await createUserWithEmailAndPassword(auth, email, password)

    try {
      if (role === 'secretary') {
        const invite = await getDoc(doc(db, 'staffInvites', email.trim().toLowerCase()))
        if (!invite.exists()) {
          const err = new Error(
            'This email address has not been approved for staff access. Ask your practice manager to add it, then try again.',
          )
          err.code = 'not-invited'
          throw err
        }
      }

      await Promise.all([
        reserveIdNumberIndexSlot(idNumber, result.user.uid, role),
        updateProfile(result.user, { displayName: name }),
      ])
    } catch (err) {
      await result.user.delete().catch(() => {})
      throw err
    }

    sendEmailVerification(result.user)
    await setDoc(doc(db, 'users', result.user.uid), {
      uid: result.user.uid,
      name,
      email,
      role,
      idNumber,
      idType,
      hasCompletedIntake: false,
      intakeDeferred: false,
      createdAt: new Date()
    })

    if (role === 'patient') {
      linkPatientDataByIdNumber(result.user.uid, idNumber, name).catch((error) => {
        console.error('Could not link existing bookings/records by ID number:', error)
      })
    }

    return result
  }

  // Log in
  async function login(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password)
    if (result.user.emailVerified) {
      const found = await loadProfile(result.user)
      if (!found) {
        await signOut(auth).catch(() => {})
        const err = new Error('Could not load profile')
        err.code = 'auth/no-profile'
        throw err
      }
    }
    return result
  }

  // Log out
  function logout() {
    return signOut(auth)
  }

  // Reset password
  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email)
  }

  async function completeIntake() {
    if (!currentUser) return
    await updateDoc(doc(db, 'users', currentUser.uid), {
      hasCompletedIntake: true,
      intakeDeferred: false,
    })
    setIntakeCompleted(true)
    setIntakeDeferred(false)
  }

  async function deferIntake() {
    setIntakeDeferred(true)
    if (!currentUser) return
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { intakeDeferred: true })
    } catch (error) {
      console.error('Could not save intake deferral:', error)
    }
  }

  async function resolveIntakeCompleted(uid, data) {
    try {
      const existing = await getIntakeFormForPatient(uid, data.idNumber)
      if (!existing) return false
      if (!existing.patientId) {
        await linkIntakeFormToPatient(existing.id, uid).catch((e) =>
          console.error('Could not link intake form to account:', e),
        )
      }
      await updateDoc(doc(db, 'users', uid), { hasCompletedIntake: true })
      return true
    } catch (error) {
      console.error('Could not check for an existing intake form:', error)
      return false
    }
  }

  async function loadProfile(user) {
    let found = false
    try {
      await user.getIdToken(true).catch(() => {})

      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists()) {
        const data = userDoc.data()
        setUserRole(data.role)
        setUserName(data.name)
        setUserIdNumber(data.idNumber || '')
        if (data.role === 'secretary' && user.emailVerified) {
          setDoc(doc(db, 'secretaryDirectory', user.uid), { uid: user.uid }).catch((e) =>
            console.error('Could not register in the secretary directory:', e),
          )
        }
        let completed =
          data.role === 'patient' ? (data.hasCompletedIntake ?? true) : true
        if (data.role === 'patient' && completed === false) {
          completed = await resolveIntakeCompleted(user.uid, data)
        }
        setIntakeCompleted(completed)
        setIntakeDeferred(!!data.intakeDeferred)
        found = true
      }
    } catch (error) {
      console.error('Error fetching user role:', error)
    }
    setCurrentUser(user)
    return found
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await loadProfile(user)
      } else {
        setCurrentUser(null)
        setUserRole(null)
        setUserName(null)
        setUserIdNumber('')
        setIntakeCompleted(undefined)
        setIntakeDeferred(undefined)
      }
      setLoading(false)
    })

    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = {
    currentUser,
    userRole,
    userName,
    userIdNumber,
    intakeCompleted,
    intakeDeferred,
    hasCompletedIntake:
      intakeCompleted === undefined ? undefined : intakeCompleted || !!intakeDeferred,
    register,
    login,
    logout,
    resetPassword,
    completeIntake,
    deferIntake
  }

  return (
    <AuthContext.Provider value={value}>
      {loading || !splashDone ? <SplashScreen /> : children}
    </AuthContext.Provider>
  )
}