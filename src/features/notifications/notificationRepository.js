import { httpsCallable } from "firebase/functions";
import { functions } from "../../lib/firebaseFunctions";

export async function markNotificationRead(notificationId) {
  if (!functions) throw new Error("Notifications are unavailable while Firebase is not configured.");
  return (await httpsCallable(functions, "markNotificationRead")({ notificationId })).data;
}

export async function markAllNotificationsRead() {
  if (!functions) throw new Error("Notifications are unavailable while Firebase is not configured.");
  return (await httpsCallable(functions, "markAllNotificationsRead")({})).data;
}

export async function deleteNotification(notificationId) {
  if (!functions) throw new Error("Notifications are unavailable while Firebase is not configured.");
  return (await httpsCallable(functions, "deleteNotification")({ notificationId })).data;
}

export async function clearNotifications({ readOnly = false } = {}) {
  if (!functions) throw new Error("Notifications are unavailable while Firebase is not configured.");
  return (await httpsCallable(functions, "clearNotifications")({ readOnly })).data;
}
