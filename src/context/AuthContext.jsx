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

// 1. Create the context
const AuthContext = createContext()

// 2. Custom hook so any component can access auth easily
export function useAuth() {
  return useContext(AuthContext)
}

// 3. The provider wraps your whole app
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // Register a new user
  async function register(email, password, role, name, practiceCode) {
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

  // Listen for auth state changes (runs on every page load)
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role)
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
    }
    setLoading(false)
  })

  return unsubscribe
}, [])

  const value = {
    currentUser,
    userRole,
    register,
    login,
    logout,
    resetPassword
  }

  // Don't render children until we know if user is logged in
  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  )
}