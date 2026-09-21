// Small notification centre: a bell icon with an unread-count badge and a
// dropdown list. Deliberately built on top of the existing useNotifications
// hook (which already subscribes to Firestore and exposes
// markNotificationRead) rather than introducing a second notification
// system - see useNotifications.js for the actual data source.
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useNotifications } from "../hooks/useNotifications";
import { formatTimeAgo } from "../utils/dateHelpers";
import EmptyState from "./EmptyState";

// Where tapping a notification should take the patient - a message or a
// reminder both land in the same chat thread (see kind: "reminder" in
// ChatThread.jsx), so anything chat-shaped should open Messages instead of
// just marking itself read and going nowhere.
const CHAT_NOTIFICATION_TYPES = new Set(["message", "reminder", "intake_reminder"]);

function routeFor(notification) {
  return CHAT_NOTIFICATION_TYPES.has(notification.type)
    ? "/patient/messages"
    : "/patient/dashboard";
}

export default function NotificationBell() {
  const { notifications, unreadCount, markNotificationRead } =
    useNotifications();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  // Close the dropdown on an outside click, same pattern as a native <select>.
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="fixed top-4 right-4 md:top-6 md:right-8 z-40"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center hover:bg-mist transition-colors"
      >
        <Bell size={20} className="text-plum" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl shadow-lg border border-sand overflow-hidden">
          <div className="px-4 py-3 border-b border-sand">
            <h2 className="text-sm font-semibold text-ink">Notifications</h2>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-sand">
            {notifications.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  icon={Bell}
                  title="No notifications"
                  message="Updates about your appointments will show up here."
                />
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    if (!n.read) markNotificationRead(n.id);
                    setOpen(false);
                    navigate(routeFor(n));
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-mist transition-colors ${
                    n.read ? "" : "bg-blush/20"
                  }`}
                >
                  <p className="text-sm text-ink">{n.message}</p>
                  <p className="text-xs text-slate mt-1">
                    {formatTimeAgo(n.createdAt)}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}