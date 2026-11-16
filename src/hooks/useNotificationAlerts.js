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
  const seenIds = useRef(null)
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

  useEffect(() => {
    if (!supported()) return
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        registrationRef.current = reg
      })
      .catch((err) => console.warn('Service worker unavailable:', err))
  }, [])

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    try {
      if (unreadCount > 0 && navigator.setAppBadge) navigator.setAppBadge(unreadCount)
      else if (navigator.clearAppBadge) navigator.clearAppBadge()
    } catch {
      // Badge support is optional.
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

  useEffect(() => {
    const currentIds = new Set(notifications.map((n) => n.id))
    if (seenIds.current === null) {
      seenIds.current = currentIds
      return
    }
    const fresh = notifications.filter(
      (n) => !seenIds.current.has(n.id) && !n.read && !dismissedIds.current.has(n.id),
    )
    seenIds.current = currentIds
    if (fresh.length === 0) return

    const route = (n) => {
      if (userRole === 'patient' && n.recipientId && currentUser?.uid && n.recipientId !== currentUser.uid) {
        const childPage = `/patient/family/${n.recipientId}`
        return n.type === 'intake_reminder' ? `${childPage}/intake` : childPage
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
        // Vibration is optional.
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
            // The browser may block system notifications.
          }
        }
      }
    })
  }, [notifications, userRole, currentUser?.uid, dismissToast])

  const enableSystemAlerts = useCallback(async () => {
    if (!supported()) return 'unsupported'
    const result = await Notification.requestPermission()
    setPermission(result)
    return result
  }, [])

  return { toasts, dismissToast, permission, enableSystemAlerts }
}