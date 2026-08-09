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

export const NOTIFICATION_BULK_BATCH_SIZE = 350;

export async function markAllTrustedNotificationsRead(db, uid, batchSize = NOTIFICATION_BULK_BATCH_SIZE) {
  if (!uid) throw new Error("Authenticated notification owner is required.");
  let changed = 0; let batchCount = 0;
  while (batchCount < 100) {
    const result = await db.runTransaction(async (transaction) => {
      const unreadQuery = db.collection(`users/${uid}/notifications`).where("read", "==", false).limit(batchSize);
      const summaryRef = db.doc(summaryPath(uid));
      const [notifications, summary] = await Promise.all([transaction.get(unreadQuery), transaction.get(summaryRef)]);
      if (notifications.empty) return 0;
      notifications.docs.forEach((item) => transaction.update(item.ref, { read: true, readAt: Timestamp.now() }));
      transaction.set(summaryRef, { unreadCount: nextUnreadCount(summary.data()?.unreadCount, -notifications.size), updatedAt: Timestamp.now() }, { merge: true });
      return notifications.size;
    });
    if (!result) break;
    changed += result; batchCount += 1;
    if (result < batchSize) break;
  }
  return { changed, batchCount };
}

export async function deleteTrustedNotification(db, uid, notificationId) {
  const notificationRef = db.doc(notificationPath(uid, notificationId));
  const summaryRef = db.doc(summaryPath(uid));
  return db.runTransaction(async (transaction) => {
    const [notification, summary] = await Promise.all([transaction.get(notificationRef), transaction.get(summaryRef)]);
    if (!notification.exists) return { found: false, deleted: false };
    const unreadDelta = notification.data().read === true ? 0 : -1;
    transaction.delete(notificationRef);
    if (unreadDelta) transaction.set(summaryRef, { unreadCount: nextUnreadCount(summary.data()?.unreadCount, unreadDelta), updatedAt: Timestamp.now() }, { merge: true });
    return { found: true, deleted: true, wasUnread: unreadDelta === -1 };
  });
}

export async function clearTrustedNotifications(db, uid, { readOnly = false, batchSize = NOTIFICATION_BULK_BATCH_SIZE } = {}) {
  if (!uid) throw new Error("Authenticated notification owner is required.");
  let deleted = 0; let unreadDeleted = 0; let batchCount = 0;
  while (batchCount < 100) {
    const result = await db.runTransaction(async (transaction) => {
      let notificationsQuery = db.collection(`users/${uid}/notifications`);
      if (readOnly) notificationsQuery = notificationsQuery.where("read", "==", true);
      notificationsQuery = notificationsQuery.limit(batchSize);
      const summaryRef = db.doc(summaryPath(uid));
      const [notifications, summary] = await Promise.all([transaction.get(notificationsQuery), transaction.get(summaryRef)]);
      if (notifications.empty) return { deleted: 0, unreadDeleted: 0 };
      const removedUnread = notifications.docs.filter((item) => item.data().read !== true).length;
      notifications.docs.forEach((item) => transaction.delete(item.ref));
      if (removedUnread) transaction.set(summaryRef, { unreadCount: nextUnreadCount(summary.data()?.unreadCount, -removedUnread), updatedAt: Timestamp.now() }, { merge: true });
      return { deleted: notifications.size, unreadDeleted: removedUnread };
    });
    if (!result.deleted) break;
    deleted += result.deleted; unreadDeleted += result.unreadDeleted; batchCount += 1;
    if (result.deleted < batchSize) break;
  }
  return { deleted, unreadDeleted, batchCount };
}
