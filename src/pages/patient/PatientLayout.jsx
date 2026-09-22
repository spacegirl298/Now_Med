// Shared shell for every patient screen: sidebar on desktop, bottom tabs on
// mobile, consistent page padding. Mirrors SecretaryLayout so both roles
// share the same app chrome.
import Sidebar from "../../components/Sidebar";
import BottomTabBar from "../../components/BottomTabBar";
import NotificationBell from "../../components/NotificationBell";
import IntakeFormButton from "../../components/IntakeFormButton";

export default function PatientLayout({ children }) {
  return (
    <div className="min-h-screen bg-sand flex">
      <Sidebar role="patient" />
      {/* Notifications only ever go to patients today (see recipientId
          usage in firebase/firestore.js) so the bell lives here rather
          than in the shared Sidebar both roles use. */}
      <NotificationBell />
      {/* Only rendered while the patient still owes us their intake form. */}
      <IntakeFormButton />
      <main className="flex-1 pb-20 md:pb-0 md:pr-20">{children}</main>
      <BottomTabBar role="patient" />
    </div>
  );
}
