import test from "node:test";
import assert from "node:assert/strict";
import { groupNotifications, notificationPresentation, notificationRoute } from "./notifications.js";

test("presentation is derived from structured metadata", () => {
  const value = notificationPresentation({ type: "follow", metadata: { actorName: "GM Saba" } });
  assert.equal(value.title, "GM Saba followed you");
});

test("authoritative game outcomes derive win and loss copy", () => {
  assert.equal(notificationPresentation({ type: "game_result", metadata: { outcome: "win", opponentName: "Court Kings" } }).title, "You defeated Court Kings");
  assert.equal(notificationPresentation({ type: "game_result", metadata: { outcome: "loss", opponentName: "Batu Ballers" } }).title, "You lost to Batu Ballers");
});

test("league lifecycle notifications remain structured and routable", () => {
  const value = notificationPresentation({ type: "league_lifecycle", metadata: { event: "league_archived", leagueName: "Dynasty" } });
  assert.equal(value.title, "League archived");
  assert.equal(value.detail, "Dynasty");
});

test("notification routes only allow internal paths", () => {
  assert.equal(notificationRoute({ metadata: { route: "/league/abc" } }), "/league/abc");
  assert.equal(notificationRoute({ metadata: { route: "https://example.com" } }), null);
  assert.equal(notificationRoute({ metadata: { route: "//example.com" } }), null);
});

test("notifications group into today, yesterday, and earlier", () => {
  const now = new Date(2026, 7, 10, 12);
  const groups = groupNotifications([
    { id: "today", createdAt: new Date(2026, 7, 10, 8) },
    { id: "yesterday", createdAt: new Date(2026, 7, 9, 8) },
    { id: "earlier", createdAt: new Date(2026, 7, 1, 8) },
  ], now);
  assert.deepEqual(groups.map(([label, items]) => [label, items[0].id]), [["Today", "today"], ["Yesterday", "yesterday"], ["Earlier", "earlier"]]);
});
