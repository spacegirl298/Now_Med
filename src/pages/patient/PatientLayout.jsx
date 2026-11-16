// Shared shell for every patient screen: sidebar on desktop; on phones a top
// app bar (brand, notifications, log out) plus bottom tabs. Mirrors
// SecretaryLayout so both roles share the same app chrome.
import Sidebar from "../../components/Sidebar";
import BottomTabBar from "../../components/BottomTabBar";
import NotificationBell from "../../components/NotificationBell";
import NotificationToasts from "../../components/NotificationToasts";
import MobileTopBar from "../../components/MobileTopBar";
import IntakeFormButton from "../../components/IntakeFormButton";
import { useNotificationAlerts } from "../../hooks/useNotificationAlerts";

export default function PatientLayout({ children }) {
  const alerts = useNotificationAlerts();

  return (
    <div className="min-h-screen bg-sand flex">
      <Sidebar role="patient" />
      <div className="flex-1 min-w-0 flex flex-col md:ml-60">
        <MobileTopBar role="patient" alerts={alerts}>
          {/* Phone: sits in the top bar. Only rendered while the patient still
              owes us their intake form. */}
          <span className="md:hidden">
            <IntakeFormButton inline />
          </span>
        </MobileTopBar>

        {/* Desktop: floating bell / intake button at the top right. */}
        <div className="hidden md:block">
          <NotificationBell alerts={alerts} />
          <IntakeFormButton />
        </div>

        <NotificationToasts toasts={alerts.toasts} onDismiss={alerts.dismissToast} />

        <main className="flex-1 min-w-0 overflow-x-hidden pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 md:pr-20">
          {children}
        </main>
      </div>
      <BottomTabBar role="patient" />
    </div>
  );
}
