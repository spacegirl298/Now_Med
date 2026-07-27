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
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { linkPatientDataByIdNumber, getUserByIdNumber } from '../firebase/firestore'


const AuthContext = createContext()


export function useAuth() {
  return useContext(AuthContext)
}

// The provider wraps your whole app
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [userName, setUserName] = useState(null)
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
      // adding a second role, not a duplicate identity.
      const existingUserWithId = await getUserByIdNumber(idNumber)
      if (existingUserWithId) {
        const isSecretarySelfRegisteringAsPatient =
          existingUserWithId.role === 'secretary' && role === 'patient'
        if (!isSecretarySelfRegisteringAsPatient) {
          throw new Error(
            'An account with this ID/passport number already exists. Please log in instead, or contact the practice if you believe this is a mistake.'
          )
        }
      }
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

useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role)
          setUserName(userDoc.data().name)
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
    }
    setLoading(false)
  })

  return unsubscribe
}, [])

  const value = {
    currentUser,
    userRole,
    userName,
    register,
    login,
    logout,
    resetPassword
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}