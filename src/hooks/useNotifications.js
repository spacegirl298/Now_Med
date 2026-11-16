import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useChildren } from "./useChildren";
import {
  subscribeToNotifications,
  markNotificationRead,
  markNotificationsRead,
} from "../firebase/firestore";

const FIRST_SNAPSHOT_WAIT_MS = 1500;

export function useNotifications() {
  const { currentUser } = useAuth();
  const { children } = useChildren();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

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
    let published = ids.length === 1;
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