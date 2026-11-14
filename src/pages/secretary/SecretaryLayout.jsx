// Shared shell for every secretary screen: sidebar on desktop; on phones a top
// app bar (brand, notifications, log out) plus bottom tabs. Keeps individual
// pages focused on content.
import Sidebar from "../../components/Sidebar";
import BottomTabBar from "../../components/BottomTabBar";
import NotificationBell from "../../components/NotificationBell";
import NotificationToasts from "../../components/NotificationToasts";
import MobileTopBar from "../../components/MobileTopBar";
import { useNotificationAlerts } from "../../hooks/useNotificationAlerts";

export default function SecretaryLayout({ children }) {
  const alerts = useNotificationAlerts();

  return (
    <div className="min-h-screen bg-sand flex">
      <Sidebar role="secretary" />
      <div className="flex-1 min-w-0 flex flex-col">
        <MobileTopBar role="secretary" alerts={alerts} />

        <div className="hidden md:block">
          <NotificationBell alerts={alerts} />
        </div>

        <NotificationToasts toasts={alerts.toasts} onDismiss={alerts.dismissToast} />

        <main className="flex-1 min-w-0 overflow-x-hidden pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 md:pr-20">
          {children}
        </main>
      </div>
      <BottomTabBar role="secretary" />
    </div>
  );
}
