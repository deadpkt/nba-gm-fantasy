import { httpsCallable } from "firebase/functions";
import { functions } from "./firebaseFunctions";

export async function markNotificationRead(notificationId) {
  if (!functions) throw new Error("Notifications are unavailable while Firebase is not configured.");
  return (await httpsCallable(functions, "markNotificationRead")({ notificationId })).data;
}
