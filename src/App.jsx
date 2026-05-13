import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

// Auth pages
import Login from './pages/auth/Login'
import SignUp from './pages/auth/SignUp'
import ForgotPassword from './pages/auth/ForgotPassword'
import EmailVerification from './pages/auth/EmailVerification'

// Patient pages
import PatientDashboard from './pages/patient/PatientDashboard'
import PatientCalendar from './pages/patient/PatientCalendar'
import PatientRecords from './pages/patient/PatientRecords'
import PatientProfile from './pages/patient/PatientProfile'

// Secretary pages
import SecretaryDashboard from './pages/secretary/SecretaryDashboard'
import SecretarySchedule from './pages/secretary/SecretarySchedule'
import PatientList from './pages/secretary/PatientList'
import SecretaryProfile from './pages/secretary/SecretaryProfile'

// Protected route wrapper
function ProtectedRoute({ children, allowedRole }) {
  const { currentUser, userRole } = useAuth()

  // Not logged in → go to login
  if (!currentUser) return <Navigate to="/login" />

  // Wrong role → redirect to their correct dashboard
  if (allowedRole && userRole !== allowedRole) {
    return <Navigate to={userRole === 'patient' 
      ? '/patient/dashboard' 
      : '/secretary/dashboard'} 
    />
  }

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<EmailVerification />} />

        {/* Patient routes */}
        <Route path="/patient/dashboard" element={
          <ProtectedRoute allowedRole="patient">
            <PatientDashboard />
          </ProtectedRoute>
        } />
        <Route path="/patient/calendar" element={
          <ProtectedRoute allowedRole="patient">
            <PatientCalendar />
          </ProtectedRoute>
        } />
        <Route path="/patient/records" element={
          <ProtectedRoute allowedRole="patient">
            <PatientRecords />
          </ProtectedRoute>
        } />
        <Route path="/patient/profile" element={
          <ProtectedRoute allowedRole="patient">
            <PatientProfile />
          </ProtectedRoute>
        } />

        {/* Secretary routes */}
        <Route path="/secretary/dashboard" element={
          <ProtectedRoute allowedRole="secretary">
            <SecretaryDashboard />
          </ProtectedRoute>
        } />
        <Route path="/secretary/schedule" element={
          <ProtectedRoute allowedRole="secretary">
            <SecretarySchedule />
          </ProtectedRoute>
        } />
        <Route path="/secretary/patients" element={
          <ProtectedRoute allowedRole="secretary">
            <PatientList />
          </ProtectedRoute>
        } />
        <Route path="/secretary/profile" element={
          <ProtectedRoute allowedRole="secretary">
            <SecretaryProfile />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}