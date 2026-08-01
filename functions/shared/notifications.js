export const NOTIFICATION_TYPES = Object.freeze([
  "follow",
  "draft_turn",
  "round_ready",
  "game_result",
  "playoff_started",
  "playoff_qualified",
  "champion",
  "trade_offer",
  "league_activity",
  "league_lifecycle",
]);

const notificationTypeSet = new Set(NOTIFICATION_TYPES);

export function isNotificationType(value) {
  return notificationTypeSet.has(value);
}

export function buildNotificationDocument({ type, actorUid = null, metadata = {}, createdAt }) {
  if (!isNotificationType(type)) throw new Error(`Unsupported notification type: ${type}`);
  if (!createdAt) throw new Error("createdAt is required.");
  if (actorUid !== null && (typeof actorUid !== "string" || !actorUid.trim())) {
    throw new Error("actorUid must be a UID or null.");
  }
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("metadata must be an object.");
  }
  return { type, actorUid: actorUid?.trim() || null, createdAt, read: false, metadata };
}

export function nextUnreadCount(currentValue, delta) {
  const current = Number.isInteger(currentValue) && currentValue > 0 ? currentValue : 0;
  return Math.max(0, current + delta);
}
