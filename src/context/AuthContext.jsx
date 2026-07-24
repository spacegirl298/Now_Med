// Manages who is logged in and what role they have
import { createContext, useContext, useEffect, useState } from 'react'
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification 
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase/config'


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
    // Create the Firebase Auth account
    const result = await createUserWithEmailAndPassword(auth, email, password)
    
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