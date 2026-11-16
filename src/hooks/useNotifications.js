// Real-time notifications for the currently logged-in user.
//
// A parent also receives the notifications addressed to their children (a
// delay, a cancellation, a practice message), merged into the same list so the
// bell, badge and toasts cover the whole family. For everyone without children
// this behaves exactly as it did before: one subscription, published at once.
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useChildren } from "./useChildren";
import {
  subscribeToNotifications,
  markNotificationRead,
  markNotificationsRead,
} from "../firebase/firestore";

// How long to wait for every family member's first snapshot before showing the
// list. It stops a child's pre-existing unread notifications arriving a moment
// after the parent's own and being mistaken for brand-new ones (which would
// fire toasts and vibrate - see useNotificationAlerts).
const FIRST_SNAPSHOT_WAIT_MS = 1500;

export function useNotifications() {
  const { currentUser } = useAuth();
  const { children } = useChildren();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  // Stable string so the effect only re-runs when the set of children changes.
  // A refused guardian can no longer read the child's notifications.
  const childKey = children
    .filter((c) => c.verificationStatus !== "rejected")
    .map((c) => c.id)
    .join(",");

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]); // eslint-disable-line react-hooks/set-state-in-effect -- clearing local state on logout
      setLoading(false);
      return;
    }

    const ids = [currentUser.uid, ...childKey.split(",").filter(Boolean)];
    const bySource = {};
    const reported = new Set();
    let published = ids.length === 1; // single source: publish immediately, as before
    let timer = null;

    const publish = () => {
      const merged = Object.values(bySource)
        .flat()
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotifications(merged);
      setLoading(false);
    };

    const unsubscribers = ids.map((id) =>
      subscribeToNotifications(id, (data) => {
        bySource[id] = data;
        reported.add(id);
        if (!published && reported.size < ids.length) return;
        published = true;
        clearTimeout(timer);
        publish();
      }),
    );

    // If a child's feed never answers (e.g. rules not updated yet), don't hold
    // the parent's own notifications back.
    if (!published) {
      timer = setTimeout(() => {
        published = true;
        publish();
      }, FIRST_SNAPSHOT_WAIT_MS);
    }

    return () => {
      clearTimeout(timer);
      unsubscribers.forEach((unsubscribe) => unsubscribe && unsubscribe());
    };
  }, [currentUser, childKey]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Marks every currently unread notification read. The live subscription
  // updates the list and the badge as the writes land.
  const markAllNotificationsRead = () =>
    markNotificationsRead(
      notifications.filter((n) => !n.read).map((n) => n.id),
    );

  return {
    notifications,
    unreadCount,
    loading,
    markNotificationRead,
    markAllNotificationsRead,
  };
}