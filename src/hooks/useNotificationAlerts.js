// Phone-style alerts for new notifications, driven by the same real-time
// Firestore subscription as the bell (useNotifications), so they arrive the
// moment the practice does something - no refresh.
//
// What it does when a NEW unread notification lands while NowMed is open
// (foreground or backgrounded on the phone):
//   - shows an in-app toast (always works),
//   - raises a system notification through the service worker if the person
//     has allowed it (shows in the phone's notification shade, tap to open),
//   - vibrates briefly and updates the home-screen app badge where supported.
//
// What it cannot do: reach a phone where the app/tab has been fully closed.
// That needs server-sent web push (Firebase Cloud Messaging + a Cloud
// Function on the paid Blaze plan), which is out of scope for this build.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNotifications } from './useNotifications'
import { useAuth } from '../context/AuthContext'

const supported = () =>
  typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator

function stripUrls(text) {
  return String(text || '').replace(/\s*https?:\/\/\S+/g, '').trim()
}

export function useNotificationAlerts() {
  const { notifications, unreadCount, markNotificationRead } = useNotifications()
  const { userRole, currentUser } = useAuth()
  const currentUserId = currentUser?.uid
  const [toasts, setToasts] = useState([])
  const [permission, setPermission] = useState(() =>
    supported() ? Notification.permission : 'unsupported',
  )
  const seenIds = useRef(null) // null until the first snapshot has been recorded
  const dismissedIds = useRef(new Set())
  const registrationRef = useRef(null)

  useEffect(() => {
    dismissedIds.current = new Set()
    if (!currentUserId) return

    try {
      const saved = JSON.parse(
        localStorage.getItem(`nowmedDismissedNotifications:${currentUserId}`) || '[]',
      )
      if (Array.isArray(saved)) {
        dismissedIds.current = new Set(saved.filter((id) => typeof id === 'string'))
      }
    } catch (err) {
      console.warn('Could not load dismissed notifications:', err)
    }
  }, [currentUserId])

  // Register the service worker once (needed for system notifications).
  useEffect(() => {
    if (!supported()) return
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registrationRef.current = reg
      })
      .catch((err) => console.warn('Service worker unavailable:', err))
  }, [])

  // Home-screen badge with the unread count (Android Chrome / installed PWA).
  useEffect(() => {
    if (typeof navigator === 'undefined') return
    try {
      if (unreadCount > 0 && navigator.setAppBadge) navigator.setAppBadge(unreadCount)
      else if (navigator.clearAppBadge) navigator.clearAppBadge()
    } catch {
      /* badge API not available */
    }
  }, [unreadCount])

  const dismissToast = useCallback((id, markRead = false) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    if (markRead) {
      dismissedIds.current.add(id)
      if (currentUserId) {
        try {
          localStorage.setItem(
            `nowmedDismissedNotifications:${currentUserId}`,
            JSON.stringify([...dismissedIds.current]),
          )
        } catch (err) {
          console.warn('Could not save dismissed notification:', err)
        }
      }
      markNotificationRead(id).catch((err) => {
        console.error('Could not mark dismissed notification as read:', err)
      })
    }
  }, [currentUserId, markNotificationRead])

  // Spot notifications that are new since the last snapshot.
  useEffect(() => {
    const currentIds = new Set(notifications.map((n) => n.id))
    if (seenIds.current === null) {
      // First snapshot = what was already there before this session started.
      // Don't replay old notifications as alerts.
      seenIds.current = currentIds
      return
    }
    const fresh = notifications.filter(
      (n) => !seenIds.current.has(n.id) && !n.read && !dismissedIds.current.has(n.id),
    )
    seenIds.current = currentIds
    if (fresh.length === 0) return

    const route = (n) => {
      // A child's notification opens that child's page.
      if (userRole === 'patient' && n.recipientId && currentUser?.uid && n.recipientId !== currentUser.uid) {
        return `/patient/family/${n.recipientId}`
      }
      const chat = ['message', 'reminder', 'intake_reminder'].includes(n.type)
      const base = userRole === 'secretary' ? '/secretary' : '/patient'
      return chat ? `${base}/messages` : `${base}/dashboard`
    }

    fresh.forEach((n) => {
      const body = stripUrls(n.message)
      setToasts((prev) => [...prev, { id: n.id, message: body, url: route(n) }].slice(-3))
      setTimeout(() => dismissToast(n.id), 7000)

      try {
        if (navigator.vibrate) navigator.vibrate([120, 60, 120])
      } catch {
        /* vibration not available */
      }

      if (supported() && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
        const options = {
          body,
          icon: '/favicon.svg',
          badge: '/favicon.svg',
          tag: n.id,
          data: { url: route(n) },
        }
        const reg = registrationRef.current
        if (reg && reg.showNotification) reg.showNotification('NowMed', options).catch(() => {})
        else {
          try {
            new Notification('NowMed', options)
          } catch {
            /* some mobile browsers only allow the service-worker route */
          }
        }
      }
    })
  }, [notifications, userRole, currentUser?.uid, dismissToast])

  // Must be called from a tap (browsers require a user gesture).
  const enableSystemAlerts = useCallback(async () => {
    if (!supported()) return 'unsupported'
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [])

  return { toasts, dismissToast, permission, enableSystemAlerts }
}