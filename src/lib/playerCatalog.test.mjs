import assert from "node:assert/strict";
import test from "node:test";
import { dedupeCatalogPlayers, findCatalogPlayerById, isCanonicalCatalogPlayer, resolvePlayerDetailsPlayer, RUNTIME_PLAYER_CATALOG_SOURCE } from "./playerCatalog.js";

test("runtime discovery is Firestore-only", () => {
  assert.equal(RUNTIME_PLAYER_CATALOG_SOURCE, "firestore-only");
});

test("manual-only Firestore rows are not canonical runtime players", () => {
  assert.equal(isCanonicalCatalogPlayer({ active: true, draftEligible: true, source: { provider: "manual" } }), false);
  assert.equal(isCanonicalCatalogPlayer({ active: true, draftEligible: true, source: { provider: "balldontlie", externalId: 115 } }), true);
});

test("manual and synced versions of the same provider identity appear once", () => {
  const players = [
    { id: "201939", name: "Stephen Curry", source: { externalId: 115 } },
    { id: "bdl_115", name: "Stephen Curry", source: { externalId: 115 } },
  ];
  assert.deepEqual(dedupeCatalogPlayers(players).map((player) => player.id), ["201939"]);
});

test("legacy IDs remain resolvable", () => {
  const legacy = { id: 201939, name: "Stephen Curry" };
  assert.equal(findCatalogPlayerById([legacy], "201939"), legacy);
});

test("Player Details prefers canonical catalog data and preserves historical fallback", () => {
  const snapshot = { id: "legacy", name: "Old Name", overall: 80 };
  const canonical = { id: "legacy", name: "Canonical Name", overall: 94 };
  assert.equal(resolvePlayerDetailsPlayer([canonical], snapshot), canonical);
  assert.equal(resolvePlayerDetailsPlayer([], snapshot), snapshot);
});
