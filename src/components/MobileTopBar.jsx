// Phone-only app bar
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./NotificationBell";
import Modal from "./Modal";

export default function MobileTopBar({ role = "patient", alerts = null, children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Could not log out:", error);
      setLoggingOut(false);
    }
  }

  return (
    <>
      <header className="md:hidden sticky top-0 z-40 /95 border-b border-sand safe-top">
        <div className="h-14 px-3 flex bg-plum text-white items-center justify-between gap-2">
          <div className="min-w-0 pl-1">
            <p
              className="text-lg font-semibold leading-tight text-white"
              style={{ fontFamily: "'Bricolage Grotesque', 'DM Sans', sans-serif" }}
            >
              <span className="text-white">Now Med</span>
            </p>
            <p className="text-[10px] uppercase tracking-wide text-blush leading-none">
              {role === "secretary" ? "Secretary Portal" : "Patient Portal"}
            </p>
          </div>

          <div className="flex items-center gap-1 ">
            {children}
            <NotificationBell inline alerts={alerts} />
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label="Log out"
              className="group w-11 h-11 rounded-full flex items-center justify-center text-white hover:bg-mist transition-colors"
            >
              <LogOut size={20} className="transition-colors group-hover:text-plum" />
            </button>
          </div>
        </div>
      </header>

      <Modal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        title="Log out?"
        confirmLabel={loggingOut ? "Logging out..." : "Log out"}
        confirmDisabled={loggingOut}
        onConfirm={handleLogout}
        cancelLabel="Stay logged in"
      >
        <p className="text-sm text-blush">
          You'll need to log in again to see your appointments and messages.
        </p>
      </Modal>
    </>
  );
}
