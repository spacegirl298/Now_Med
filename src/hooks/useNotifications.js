// Real-time notifications for the currently logged-in user.
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  subscribeToNotifications,
  markNotificationRead,
  markNotificationsRead,
} from "../firebase/firestore";

export function useNotifications() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]); // eslint-disable-line react-hooks/set-state-in-effect -- clearing local state on logout
      setLoading(false);
      return;
    }
    const unsubscribe = subscribeToNotifications(currentUser.uid, (data) => {
      setNotifications(data);
      setLoading(false);
    });
    return () => unsubscribe && unsubscribe();
  }, [currentUser]);

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
