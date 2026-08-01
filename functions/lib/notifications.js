import { Timestamp } from "firebase-admin/firestore";
import { buildNotificationDocument, nextUnreadCount } from "../shared/notifications.js";

const summaryPath = (uid) => `users/${uid}/notificationMeta/summary`;
const notificationPath = (uid, id) => `users/${uid}/notifications/${id}`;

// Trusted producer primitive for later phases. Phase 19.1 intentionally does
// not invoke this from any product workflow.
export async function createTrustedNotification(db, recipientUid, input) {
  if (typeof recipientUid !== "string" || !recipientUid.trim()) throw new Error("recipientUid is required.");
  const notificationRef = input.id
    ? db.doc(notificationPath(recipientUid, input.id))
    : db.collection(`users/${recipientUid}/notifications`).doc();
  const summaryRef = db.doc(summaryPath(recipientUid));
  const document = buildNotificationDocument({ ...input, createdAt: Timestamp.now() });
  await db.runTransaction(async (transaction) => {
    const [existing, summary] = await Promise.all([
      transaction.get(notificationRef),
      transaction.get(summaryRef),
    ]);
    if (existing.exists) return;
    transaction.create(notificationRef, document);
    transaction.set(summaryRef, {
      unreadCount: nextUnreadCount(summary.data()?.unreadCount, 1),
      updatedAt: Timestamp.now(),
    }, { merge: true });
  });
  return notificationRef.id;
}

export function notificationEventId(...parts) {
  return parts.map((part) => String(part).replace(/[^A-Za-z0-9_-]/g, "_")).join("-").slice(0, 150);
}

export async function createTrustedNotifications(db, recipients, inputForRecipient) {
  const uniqueRecipients = [...new Set((recipients || []).filter((uid) => typeof uid === "string" && uid))];
  const results = await Promise.allSettled(uniqueRecipients.map((uid) => createTrustedNotification(
    db,
    uid,
    typeof inputForRecipient === "function" ? inputForRecipient(uid) : inputForRecipient,
  )));
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length) throw new AggregateError(failed.map((result) => result.reason), `Failed to deliver ${failed.length} notification(s).`);
  return { delivered: uniqueRecipients.length };
}

export async function markTrustedNotificationRead(db, uid, notificationId) {
  const notificationRef = db.doc(notificationPath(uid, notificationId));
  const summaryRef = db.doc(summaryPath(uid));
  return db.runTransaction(async (transaction) => {
    const [notification, summary] = await Promise.all([
      transaction.get(notificationRef),
      transaction.get(summaryRef),
    ]);
    if (!notification.exists) return { found: false, changed: false };
    if (notification.data().read === true) return { found: true, changed: false };
    const now = Timestamp.now();
    transaction.update(notificationRef, { read: true });
    transaction.set(summaryRef, {
      unreadCount: nextUnreadCount(summary.data()?.unreadCount, -1),
      updatedAt: now,
    }, { merge: true });
    return { found: true, changed: true };
  });
}
