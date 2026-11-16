import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { arrayUnion, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import app, { db } from './config'

// Asks Firebase for this browser's push token and files it under the user so
// the Cloud Function can reach them when the app is closed.
export async function registerPushToken(uid, swRegistration) {
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
  if (!vapidKey || !uid || !swRegistration) return null
  if (!(await isSupported())) return null

  const token = await getToken(getMessaging(app), {
    vapidKey,
    serviceWorkerRegistration: swRegistration,
  })
  if (!token) return null

  await setDoc(
    doc(db, 'pushTokens', uid),
    { tokens: arrayUnion(token), updatedAt: serverTimestamp() },
    { merge: true },
  )
  return token
}
