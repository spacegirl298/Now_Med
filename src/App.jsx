import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Auth pages
import Welcome from "./pages/auth/Welcome";
import Login from "./pages/auth/Login";
import SignUp from "./pages/auth/SignUp";
import ForgotPassword from "./pages/auth/ForgotPassword";
import EmailVerification from "./pages/auth/EmailVerfication";
import NotFound from "./pages/NotFound";

// Patient pages
import PatientDashboard from "./pages/patient/PatientDashboard";
import PatientCalendar from "./pages/patient/PatientCalendar";
import PatientRecords from "./pages/patient/PatientRecords";
import PatientProfile from "./pages/patient/PatientProfile";
import PatientIntake from "./pages/patient/PatientIntake";
import PatientMessages from "./pages/patient/PatientMessages";
import PatientFamily from "./pages/patient/PatientFamily";
import PatientChild from "./pages/patient/PatientChild";
import ChildCalendar from "./pages/patient/ChildCalendar";
import ChildIntake from "./pages/patient/ChildIntake";

// Secretary pages
import SecretaryDashboard from "./pages/secretary/SecretaryDashboard";
import SecretarySchedule from "./pages/secretary/SecretarySchedule";
import PatientList from "./pages/secretary/PatientList";
import SecretaryProfile from "./pages/secretary/SecretaryProfile";
import SecretaryMessages from "./pages/secretary/SecretaryMessages";
import SecretaryAnalytics from "./pages/secretary/SecretaryAnalytics";

const DEV_BYPASS_ROLE = false;

// Protected route wrapper
function ProtectedRoute({ children, allowedRole }) {
  const { currentUser, userRole } = useAuth();

  // Development bypass
  if (DEV_BYPASS_ROLE) {
    return children;
  }

  if (!currentUser) return <Navigate to="/" replace />;


  if (!currentUser.emailVerified) return <Navigate to="/verify-email" replace />;


  if (!userRole) return <Navigate to="/login" replace />;

  if (allowedRole && userRole !== allowedRole) {
    return (
      <Navigate
        to={
          userRole === "patient" ? "/patient/dashboard" : "/secretary/dashboard"
        }
        replace
      />
    );
  }

  return children;
}


function RequireIntake({ children }) {
  const { hasCompletedIntake } = useAuth();

  if (hasCompletedIntake === undefined) return null;
  if (hasCompletedIntake === false) {
    return <Navigate to="/patient/intake" />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-email" element={<EmailVerification />} />

        {/* Patient routes */}

        <Route
          path="/patient/intake"
          element={
            <ProtectedRoute allowedRole="patient">
              <PatientIntake />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/dashboard"
          element={
            <ProtectedRoute allowedRole="patient">
              <PatientDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/calendar"
          element={
            <ProtectedRoute allowedRole="patient">
              <RequireIntake>
                <PatientCalendar />
              </RequireIntake>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/records"
          element={
            <ProtectedRoute allowedRole="patient">
              <RequireIntake>
                <PatientRecords />
              </RequireIntake>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/messages"
          element={
            <ProtectedRoute allowedRole="patient">
              <RequireIntake>
                <PatientMessages />
              </RequireIntake>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/profile"
          element={
            <ProtectedRoute allowedRole="patient">

              <PatientProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/family"
          element={
            <ProtectedRoute allowedRole="patient">
              <RequireIntake>
                <PatientFamily />
              </RequireIntake>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/family/:childId"
          element={
            <ProtectedRoute allowedRole="patient">
              <RequireIntake>
                <PatientChild />
              </RequireIntake>
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/family/:childId/calendar"
          element={
            <ProtectedRoute allowedRole="patient">
              <RequireIntake>
                <ChildCalendar />
              </RequireIntake>
            </ProtectedRoute>
          }
        />

        <Route
          path="/patient/family/:childId/intake"
          element={
            <ProtectedRoute allowedRole="patient">
              <RequireIntake>
                <ChildIntake />
              </RequireIntake>
            </ProtectedRoute>
          }
        />

        {/* Secretary routes */}
        <Route
          path="/secretary/dashboard"
          element={
            <ProtectedRoute allowedRole="secretary">
              <SecretaryDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretary/schedule"
          element={
            <ProtectedRoute allowedRole="secretary">
              <SecretarySchedule />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretary/patients"
          element={
            <ProtectedRoute allowedRole="secretary">
              <PatientList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretary/messages"
          element={
            <ProtectedRoute allowedRole="secretary">
              <SecretaryMessages />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretary/analytics"
          element={
            <ProtectedRoute allowedRole="secretary">
              <SecretaryAnalytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretary/profile"
          element={
            <ProtectedRoute allowedRole="secretary">
              <SecretaryProfile />
            </ProtectedRoute>
          }
        />

        {/* Anything else */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
