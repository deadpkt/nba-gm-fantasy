import test from "node:test";
import assert from "node:assert/strict";
import { buildLeagueActivityDocument, LEAGUE_ACTIVITY_TYPES } from "../shared/leagueActivity.js";
import { activityEventId, createTrustedLeagueActivity } from "../lib/leagueActivity.js";

function fakeFirestore() {
  const values = new Map();
  return { values, doc: (path) => ({ path, id: path.split("/").at(-1) }), runTransaction: async (callback) => callback({
    get: async (ref) => ({ exists: values.has(ref.path) }),
    create: (ref, value) => values.set(ref.path, value),
  }) };
}

test("Phase 20 supports only the requested structured activity types", () => {
  assert.equal(LEAGUE_ACTIVITY_TYPES.length, 16);
  assert.throws(() => buildLeagueActivityDocument({ type: "comment", createdAt: {}, metadata: {} }));
  assert.deepEqual(buildLeagueActivityDocument({ type: "game_finished", createdAt: 1, actorUid: "winner", targetUid: "loser", gameId: "g1", metadata: { round: 2 } }), {
    type: "game_finished", createdAt: 1, actorUid: "winner", targetUid: "loser", gameId: "g1", metadata: { round: 2 },
  });
});

test("activity IDs are stable and Firestore safe", () => {
  assert.equal(activityEventId("game-finished", "game/1"), "game-finished-game_1");
  assert.equal(activityEventId("round", 2, 3), activityEventId("round", 2, 3));
});

test("trusted activity retries create a single document", async () => {
  const database = fakeFirestore();
  const input = { id: "draft-pick-1", type: "player_drafted", metadata: { playerName: "Stephen Curry" } };
  await createTrustedLeagueActivity(database, "league", input);
  await createTrustedLeagueActivity(database, "league", input);
  assert.equal(database.values.size, 1);
});
