// Sends a phone / browser push whenever a notification document is created,
// so alerts also arrive when Now Med is fully closed.
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

initializeApp();
const db = getFirestore("jj04"); // our named Firestore database

const CHAT_TYPES = ["message", "reminder", "intake_reminder"];
const DEAD_TOKEN_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
];

const stripUrls = (text) =>
  String(text || "")
    .replace(/\s*https?:\/\/\S+/g, "")
    .trim();


// Firestore, Databases). Trigger and database must be in the same region.
export const sendPushOnNotification = onDocumentCreated(
  {
    document: "notifications/{notificationId}",
    database: "jj04",
    region: "africa-south1",
  },
  async (event) => {
    const notification = event.data?.data();
    if (!notification?.recipientId) return;

    const tokenDoc = await db
      .doc(`pushTokens/${notification.recipientId}`)
      .get();
    const tokens = tokenDoc.exists ? tokenDoc.data().tokens || [] : [];
    if (tokens.length === 0) return;

    const userDoc = await db.doc(`users/${notification.recipientId}`).get();
    const base =
      userDoc.exists && userDoc.data().role === "secretary"
        ? "/secretary"
        : "/patient";
    const url = CHAT_TYPES.includes(notification.type)
      ? `${base}/messages`
      : `${base}/dashboard`;

    const result = await getMessaging().sendEachForMulticast({
      tokens,
      data: {
        title: "NowMed",
        body: stripUrls(notification.message),
        url,
        tag: event.params.notificationId,
      },
      webpush: { headers: { Urgency: "high", TTL: "3600" } },
    });

    const dead = [];
    result.responses.forEach((r, i) => {
      if (!r.success && DEAD_TOKEN_CODES.includes(r.error?.code))
        dead.push(tokens[i]);
    });
    if (dead.length > 0)
      await tokenDoc.ref.update({ tokens: FieldValue.arrayRemove(...dead) });
    logger.info("Push sent", {
      sent: result.successCount,
      failed: result.failureCount,
    });
  },
);
