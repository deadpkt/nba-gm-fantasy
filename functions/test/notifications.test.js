import test from "node:test";
import assert from "node:assert/strict";
import { buildNotificationDocument, isNotificationType, nextUnreadCount } from "../shared/notifications.js";
import { createTrustedNotification, notificationEventId } from "../lib/notifications.js";

function fakeFirestore() {
  const values = new Map();
  const reference = (path) => ({ path });
  return {
    values,
    doc: reference,
    collection: (path) => ({ doc: () => reference(`${path}/auto`) }),
    runTransaction: async (callback) => callback({
      get: async (ref) => ({ exists: values.has(ref.path), data: () => values.get(ref.path) }),
      create: (ref, value) => values.set(ref.path, value),
      set: (ref, value, options) => values.set(ref.path, options?.merge ? { ...(values.get(ref.path) || {}), ...value } : value),
      update: (ref, value) => values.set(ref.path, { ...values.get(ref.path), ...value }),
    }),
  };
}

test("notification model accepts all Phase 19.1 foundation types", () => {
  for (const type of ["follow", "draft_turn", "round_ready", "game_result", "playoff_started", "playoff_qualified", "champion", "trade_offer", "league_activity", "league_lifecycle"]) assert.equal(isNotificationType(type), true);
  assert.equal(isNotificationType("arbitrary"), false);
});

test("notification documents contain structured data rather than rendered messages", () => {
  const createdAt = { seconds: 1 };
  assert.deepEqual(buildNotificationDocument({ type: "follow", actorUid: "actor", metadata: { actorName: "GM" }, createdAt }), {
    type: "follow", actorUid: "actor", createdAt, read: false, metadata: { actorName: "GM" },
  });
});

test("unread count cannot become negative", () => {
  assert.equal(nextUnreadCount(1, -1), 0);
  assert.equal(nextUnreadCount(0, -1), 0);
  assert.equal(nextUnreadCount(undefined, 1), 1);
});

test("authoritative event IDs are deterministic and Firestore safe", () => {
  assert.equal(notificationEventId("draft", "league/one", 2, 7), "draft-league_one-2-7");
  assert.equal(notificationEventId("draft", "league/one", 2, 7), notificationEventId("draft", "league/one", 2, 7));
  assert.notEqual(notificationEventId("round-ready", "league", 2, 1), notificationEventId("round-ready", "league", 2, 2));
});

test("deterministic notification retries create once and increment unread once", async () => {
  const database = fakeFirestore();
  const input = { id: "draft-league-1-7", type: "draft_turn", metadata: { pickNumber: 7 } };
  await createTrustedNotification(database, "drafter", input);
  await createTrustedNotification(database, "drafter", input);
  assert.equal(database.values.get("users/drafter/notificationMeta/summary").unreadCount, 1);
  assert.equal([...database.values.keys()].filter((path) => path.includes("/notifications/")).length, 1);
});
