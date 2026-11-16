// Small notification centre: a bell icon with an unread-count badge and a
// dropdown list. Deliberately built on top of the existing useNotifications
// hook (which already subscribes to Firestore and exposes
// markNotificationRead) rather than introducing a second notification
// system - see useNotifications.js for the actual data source.
//
// `inline` places the bell in normal flow (used by the mobile top bar);
// otherwise it floats at the top right of the screen (desktop).
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellRing, Video } from "lucide-react";
import { useNotifications } from "../hooks/useNotifications";
import { useAuth } from "../context/AuthContext";
import { formatTimeAgo } from "../utils/dateHelpers";
import EmptyState from "./EmptyState";

// Where tapping a notification should take the patient - a message or a
// reminder both land in the same chat thread (see kind: "reminder" in
// ChatThread.jsx), so anything chat-shaped should open Messages instead of
// just marking itself read and going nowhere.
const CHAT_NOTIFICATION_TYPES = new Set([
  "message",
  "reminder",
  "intake_reminder",
]);

function routeFor(notification, userRole) {
  return CHAT_NOTIFICATION_TYPES.has(notification.type)
    ? userRole === "secretary"
      ? "/secretary/messages"
      : "/patient/messages"
    : userRole === "secretary"
      ? "/secretary/dashboard"
      : "/patient/dashboard";
}

// A notification addressed to one of the parent's children (a delay, a
// cancellation, a message) opens that child's page instead of the parent's own.
function targetFor(notification, userRole, ownUid) {
  if (
    userRole === "patient" &&
    notification.recipientId &&
    ownUid &&
    notification.recipientId !== ownUid
  ) {
    const childPage = `/patient/family/${notification.recipientId}`;
    // A reminder to fill in the child's intake form opens the form itself.
    return notification.type === "intake_reminder"
      ? `${childPage}/intake`
      : childPage;
  }
  return routeFor(notification, userRole);
}

// Notification text can carry an online-meeting link. Show the sentence
// cleanly and offer the link as its own tappable "Join" button.
function splitMeetingLink(message) {
  const match = String(message || "").match(/https:\/\/\S+/);
  if (!match) return { text: message, link: "" };
  return {
    text: message.replace(match[0], "").replace(/\s*(Join online:|join here:)\s*$/i, "").trim(),
    link: match[0],
  };
}

export default function NotificationBell({
  inline = false,
  alerts = null, // { permission, enableSystemAlerts } from useNotificationAlerts
}) {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } =
    useNotifications();
  const { userRole, currentUser } = useAuth();
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
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const canAskForAlerts =
    alerts && alerts.permission === "default" && alerts.enableSystemAlerts;

  return (
    <div
      ref={wrapperRef}
      className={inline ? "relative" : "fixed top-4 right-4 md:top-6 md:right-20 z-40"}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className={`group relative w-11 h-11 rounded-full flex items-center justify-center hover:bg-mist transition-colors ${
          inline ? "bg-transparent" : "bg-white shadow-sm"
        }`}
      >
        <Bell size={20} className="text-white transition-colors group-hover:text-plum" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 rounded-full bg-rose text-white text-[10px] font-semibold flex items-center justify-center hover: text-plum transition-colors">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`bg-white rounded-2xl shadow-lg border border-sand overflow-hidden ${
            inline
              ? "fixed left-3 right-3 top-16 z-50"
              : "absolute right-0 mt-2 w-80 max-w-[90vw] "
          }`}
        >
          <div className="px-4 py-3 border-b border-sand flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Notifications</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllNotificationsRead().catch(() => {})}
                className="text-xs font-medium text-rose hover:text-plum py-1"
              >
                Mark all as read
              </button>
            )}
          </div>

          {canAskForAlerts && (
            <button
              type="button"
              onClick={() => alerts.enableSystemAlerts()}
              className="w-full flex items-center gap-2 px-4 py-3 text-left text-xs font-medium text-rose bg-mist border-b border-sand hover:bg-blush/40 transition-colors"
            >
              <BellRing size={14} className="shrink-0" />
              Turn on phone alerts so updates pop up even when NowMed is in the
              background
            </button>
          )}

          <div className="max-h-[60dvh] md:max-h-80 overflow-y-auto divide-y divide-sand">
            {notifications.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  icon={Bell}
                  title="No notifications"
                  message="Updates about your appointments will show up here."
                />
              </div>
            ) : (
              notifications.map((n) => {
                const { text, link } = splitMeetingLink(n.message);
                return (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!n.read) markNotificationRead(n.id);
                      setOpen(false);
                      navigate(targetFor(n, userRole, currentUser?.uid), {
                        state: n.patientId
                          ? { patientId: n.patientId }
                          : undefined,
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.currentTarget.click();
                      }
                    }}
                    className={`w-full text-left px-4 py-3 cursor-pointer hover:bg-mist transition-colors ${
                      n.read ? "" : "bg-blush/20"
                    }`}
                  >
                    <p className="text-sm text-ink break-words">{text}</p>
                    {link && userRole !== "patient" && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!n.read) markNotificationRead(n.id);
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-white bg-rose rounded-lg px-3 py-2 hover:bg-plum transition-colors"
                      >
                        <Video size={13} /> Join online consult
                      </a>
                    )}
                    <p className="text-xs text-slate mt-1">
                      {formatTimeAgo(n.createdAt)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
