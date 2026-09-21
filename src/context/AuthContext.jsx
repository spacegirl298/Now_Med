// Manages who is logged in and what role they have
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

// The provider wraps your whole app
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [userName, setUserName] = useState(null)
  const [userIdNumber, setUserIdNumber] = useState('')
  // Intake state (patients only). Both are undefined until the user doc has
  // loaded, so callers can tell "still loading" from "not done yet".
  //   intakeCompleted - a full intake form exists for this patient
  //   intakeDeferred  - they chose "Do this later" on the first-login prompt.
  //                     They are not prompted again, but the floating intake
  //                     button stays visible until the form is completed.
  const [intakeCompleted, setIntakeCompleted] = useState(undefined)
  const [intakeDeferred, setIntakeDeferred] = useState(undefined)
  const [loading, setLoading] = useState(true)

  // Register a new user
  async function register(email, password, idNumber, idType, role, name, practiceCode) {
    // Create the Firebase Auth account first - the duplicate-ID check below
    // reads the `users` collection, and Firestore rules require the caller
    // to be authenticated to do that. Checking before sign-up would fail
    // with a permission error for every registration, not just duplicates.
    const result = await createUserWithEmailAndPassword(auth, email, password)

    try {
      // Two different people should never be able to register with the same
      // ID/passport number. The one deliberate exception: a secretary who
      // already has a staff account is allowed to register a *patient*
      // account under that same ID number — that's the same real person
      // adding a second role, not a duplicate identity. This is enforced
      // by reserveIdNumberIndexSlot against idNumberIndex/{idNumber},
      // which mirrors the firestore.rules logic for that collection.
      // (A direct query against `users` won't work here — a brand-new
      // registrant has no user doc yet, so isSecretary()/isOwner() in the
      // rules can't be satisfied and the query is denied.)
      await reserveIdNumberIndexSlot(idNumber, result.user.uid, role)
    } catch (err) {
      // Roll back the auth account we just created so we don't leave an
      // orphaned login with no matching Firestore user doc.
      await result.user.delete().catch(() => {})
      throw err
    }

    // So displayName is available anywhere we read it straight off the Auth
    // user (e.g. profile pages), not just from the Firestore user doc
    await updateProfile(result.user, { displayName: name })

    //sending Verification email 
    sendEmailVerification(result.user)
    // This saves their information to Firestore
    await setDoc(doc(db, 'users', result.user.uid), {
      uid: result.user.uid,
      name,
      email,
      role,
      idNumber,
      idType, // 'sa_id' or 'passport'
      practiceCode: practiceCode || '',
      hasCompletedIntake: false,
      intakeDeferred: false,
      createdAt: new Date()
    })

    // If a secretary already booked appointments or added records for this
    // person by ID number (e.g. a phone-in booking), attach that history to
    // the new account now so it shows up immediately.
    if (role === 'patient') {
      try {
        await linkPatientDataByIdNumber(result.user.uid, idNumber, name)
      } catch (error) {
        console.error('Could not link existing bookings/records by ID number:', error)
      }
    }

    return result
  }

  // Log in
  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  // Log out
  function logout() {
    return signOut(auth)
  }

  // Reset password
  function resetPassword(email) {
    return sendPasswordResetEmail(auth, email)
  }

  // Called by PatientIntake.jsx after the form has been saved.
  async function completeIntake() {
    if (!currentUser) return
    await updateDoc(doc(db, 'users', currentUser.uid), {
      hasCompletedIntake: true,
      intakeDeferred: false,
    })
    setIntakeCompleted(true)
    setIntakeDeferred(false)
  }

  // "Do this later" on the intake prompt. Stops the automatic redirect
  // (so the prompt really is only shown once) without pretending the form
  // was filled in. State is set even if the write fails so this session
  // isn't stuck in a redirect loop.
  async function deferIntake() {
    setIntakeDeferred(true)
    if (!currentUser) return
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { intakeDeferred: true })
    } catch (error) {
      console.error('Could not save intake deferral:', error)
    }
  }

  // First-login check: is there already an intake form for this patient,
  // either under their uid or attached to their ID/passport number (e.g. the
  // practice captured one before they registered)? If so they never see the
  // prompt.
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

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          const data = userDoc.data()
          setUserRole(data.role)
          setUserName(data.name)
          setUserIdNumber(data.idNumber || '')
          // Older accounts created before this field existed won't have it —
          // treat missing as "already done" so nobody who registered before
          // this feature shipped gets an unexpected intake prompt. Staff never
          // do intake.
          let completed =
            data.role === 'patient' ? (data.hasCompletedIntake ?? true) : true
          if (data.role === 'patient' && completed === false) {
            completed = await resolveIntakeCompleted(user.uid, data)
          }
          setIntakeCompleted(completed)
          setIntakeDeferred(!!data.intakeDeferred)
        }
        setCurrentUser(user)
      } catch (error) {
        // If Firestore read fails, still set the user
        // so they aren't stuck on a blank page
        console.error('Error fetching user role:', error)
        setCurrentUser(user)
      }
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
}, [])

  const value = {
    currentUser,
    userRole,
    userName,
    userIdNumber,
    intakeCompleted,
    intakeDeferred,
    // Kept under its old name so App.jsx's RequireIntake works unchanged: it
    // redirects to the intake page only while this is === false, i.e. only
    // for a patient who has neither completed nor deferred the form.
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
      {!loading && children}
    </AuthContext.Provider>
  )
}