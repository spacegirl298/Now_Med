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

// Secretary pages
import SecretaryDashboard from "./pages/secretary/SecretaryDashboard";
import SecretarySchedule from "./pages/secretary/SecretarySchedule";
import PatientList from "./pages/secretary/PatientList";
import SecretaryProfile from "./pages/secretary/SecretaryProfile";
import SecretaryMessages from "./pages/secretary/SecretaryMessages";
import SecretaryAnalytics from "./pages/secretary/SecretaryAnalytics";

//dev bypass flag that allows us to view the dashboards without having to keep logging back in
const DEV_BYPASS_ROLE = false;

// Protected route wrapper
function ProtectedRoute({ children, allowedRole }) {
  const { currentUser, userRole } = useAuth();

  //Dev bypass
  if (DEV_BYPASS_ROLE) {
    return children;
  }

  if (!currentUser) return <Navigate to="/" replace />;

  // Signed in but not verified yet (they are still on the sign-up flow):
  // nothing behind this wall works until the email is verified - staff access
  // in particular is denied by Firestore - so park them on the verify screen.
  if (!currentUser.emailVerified) return <Navigate to="/verify-email" replace />;

  // Signed in, but no role resolved (the user doc is missing or couldn't be
  // read). Never guess a dashboard for them - that used to bounce patients
  // into /secretary and loop. Send them back to log in instead.
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

// Redirects a patient who hasn't completed the first-time intake form to
// it, before they can reach any other patient page. Only meaningful for
// the patient role — nest this INSIDE ProtectedRoute allowedRole="patient"
// so userRole is already guaranteed to be "patient" by the time this runs.
//
// hasCompletedIntake (from AuthContext) means "don't force the form": it is
// true once the form is submitted OR the patient chose "Do this later", so
// the redirect below only ever fires on a patient's first login. After a
// deferral, the floating IntakeFormButton (in PatientLayout) brings them back.
//
// While hasCompletedIntake is still loading (undefined) we render nothing
// rather than redirecting, to avoid a flash-redirect to /patient/intake on
// every page load before the user doc has come back.
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
        {/* Intake itself is NOT wrapped in RequireIntake - that would be a
            redirect loop for the exact patients who need to see it. */}
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
              {/* Profile is reachable even mid-intake-skip so a patient can
                  always find/edit these fields later - not gated. */}
              <PatientProfile />
            </ProtectedRoute>
          }
        />

        {/* Family: a parent managing their children's profiles */}
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
