import test from "node:test";
import assert from "node:assert/strict";
import { buildNotificationDocument, isNotificationType, nextUnreadCount } from "../shared/notifications.js";
import { clearTrustedNotifications, createTrustedNotification, deleteTrustedNotification, markAllTrustedNotificationsRead, markTrustedNotificationRead, notificationEventId, NOTIFICATION_BULK_BATCH_SIZE } from "../lib/notifications.js";

function fakeFirestore() {
  const values = new Map();
  const querySizes = [];
  const reference = (path) => ({ path, id: path.split("/").at(-1) });
  const queryRef = (path, filters = [], max = Infinity) => ({ kind: "query", path, filters, max, where(field, operator, value) { return queryRef(path, [...filters, [field, operator, value]], max); }, limit(value) { return queryRef(path, filters, value); }, doc: () => reference(`${path}/auto`) });
  const querySnapshot = (query) => { const rows = [...values.entries()].filter(([path, value]) => path.startsWith(`${query.path}/`) && path.slice(query.path.length + 1).split("/").length === 1 && query.filters.every(([field,, expected]) => value[field] === expected)).slice(0, query.max).map(([path, value]) => ({ ref: reference(path), id: path.split("/").at(-1), data: () => value })); querySizes.push(rows.length); return { docs: rows, size: rows.length, empty: rows.length === 0 }; };
  return {
    values, querySizes,
    doc: reference,
    collection: (path) => queryRef(path),
    runTransaction: async (callback) => callback({
      get: async (ref) => ref.kind === "query" ? querySnapshot(ref) : ({ exists: values.has(ref.path), data: () => values.get(ref.path) }),
      create: (ref, value) => values.set(ref.path, value),
      set: (ref, value, options) => values.set(ref.path, options?.merge ? { ...(values.get(ref.path) || {}), ...value } : value),
      update: (ref, value) => values.set(ref.path, { ...values.get(ref.path), ...value }),
      delete: (ref) => values.delete(ref.path),
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

test("individual read and delete update only the owner's notification and unread count", async () => {
  const database = fakeFirestore();
  database.values.set("users/a/notifications/n1", { read: false }); database.values.set("users/a/notificationMeta/summary", { unreadCount: 1 }); database.values.set("users/b/notifications/n1", { read: false });
  await markTrustedNotificationRead(database, "a", "n1"); assert.equal(database.values.get("users/a/notifications/n1").read, true); assert.equal(database.values.get("users/b/notifications/n1").read, false);
  await deleteTrustedNotification(database, "a", "n1"); assert.equal(database.values.has("users/a/notifications/n1"), false); assert.equal(database.values.has("users/b/notifications/n1"), true);
});

test("mark all read is safe at zero and processes hundreds in bounded groups", async () => {
  const database = fakeFirestore(); const total = 780;
  for (let index = 0; index < total; index += 1) database.values.set(`users/a/notifications/n${index}`, { read: false });
  database.values.set("users/a/notificationMeta/summary", { unreadCount: total });
  const result = await markAllTrustedNotificationsRead(database, "a"); assert.equal(result.changed, total); assert.equal(database.values.get("users/a/notificationMeta/summary").unreadCount, 0); assert.ok(database.querySizes.every((size) => size <= NOTIFICATION_BULK_BATCH_SIZE));
  assert.deepEqual(await markAllTrustedNotificationsRead(database, "a"), { changed: 0, batchCount: 0 });
});

test("clear all deletes only the selected owner's documents in bounded groups", async () => {
  const database = fakeFirestore(); const total = 720;
  for (let index = 0; index < total; index += 1) database.values.set(`users/a/notifications/n${index}`, { read: index % 2 === 0 });
  database.values.set("users/a/notificationMeta/summary", { unreadCount: total / 2 }); database.values.set("users/b/notifications/keep", { read: false });
  const result = await clearTrustedNotifications(database, "a"); assert.equal(result.deleted, total); assert.equal(database.values.get("users/a/notificationMeta/summary").unreadCount, 0); assert.equal(database.values.has("users/b/notifications/keep"), true); assert.ok(database.querySizes.every((size) => size <= NOTIFICATION_BULK_BATCH_SIZE));
});
