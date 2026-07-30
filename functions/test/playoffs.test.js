import assert from "node:assert/strict";
import test from "node:test";
import { buildChampionship, buildFinalMatchup, buildPlayoffInitialization, playoffGameId } from "../shared/playoffs.js";

const qualifiers = [1, 2, 3, 4].map((seed) => ({ seed, uid: `u${seed}`, teamName: `Team ${seed}` }));
const league = (field = qualifiers, size = 4) => ({ id: "league", status: "regular_season", season: 1, memberIds: Array.from({ length: size }, (_, index) => `u${index + 1}`), seasonConfig: { scheduleVersion: 1 }, regularSeasonResult: { season: 1 }, postseason: { status: "ready", season: 1, qualifiers: field } });

test("two-team field creates only the seeded Final", () => {
  const result = buildPlayoffInitialization(league(qualifiers.slice(0, 2), 2));
  assert.equal(result.postseason.status, "finals");
  assert.deepEqual(result.games.map((game) => [game.id, game.homeSeed, game.awaySeed]), [[playoffGameId(1, "final"), 1, 2]]);
});

test("four-team field creates one-versus-four and two-versus-three", () => {
  const result = buildPlayoffInitialization(league());
  assert.equal(result.postseason.status, "semifinals");
  assert.deepEqual(result.games.map((game) => [game.homeSeed, game.awaySeed]), [[1, 4], [2, 3]]);
});

test("trusted semifinal results create exactly one correctly seeded Final", () => {
  const initialized = buildPlayoffInitialization(league());
  const semifinals = initialized.games.map((game, index) => ({ ...game, status: "completed", result: { winnerUid: index ? "u3" : "u1", loserUid: index ? "u2" : "u4" } }));
  const final = buildFinalMatchup({ ...league(), status: "playoffs", postseason: initialized.postseason }, semifinals);
  assert.equal(final.id, playoffGameId(1, "final"));
  assert.deepEqual([final.homeUid, final.awayUid, final.sourceGameIds.length], ["u1", "u3", 2]);
});

test("Final result creates champion and completed retry stays stable", () => {
  const postseason = { ...league().postseason, status: "finals" };
  const game = { stage: "final", status: "completed", result: { winnerUid: "u2", loserUid: "u1" } };
  const first = buildChampionship(postseason, game, "now");
  assert.deepEqual([first.postseason.champion.uid, first.postseason.runnerUp.uid], ["u2", "u1"]);
  const retry = buildChampionship(first.postseason, game, "later");
  assert.equal(retry.alreadyCompleted, true);
  assert.deepEqual(retry.postseason, first.postseason);
});

test("generated playoff results cannot advance the bracket or expose a champion early", () => {
  const initialized = buildPlayoffInitialization(league());
  const semifinals = initialized.games.map((game, index) => ({ ...game, status: "in_progress", result: { winnerUid: index ? "u3" : "u1" } }));
  assert.throws(() => buildFinalMatchup({ ...league(), status: "playoffs", postseason: initialized.postseason }, semifinals), /must be completed/);
  assert.throws(() => buildChampionship({ ...league().postseason, status: "finals" }, { stage: "final", status: "in_progress", result: { winnerUid: "u1", loserUid: "u2" } }, "now"), /completed Final/);
});

test("six and eight-team leagues use only their frozen top-four", () => {
  for (const size of [6, 8]) {
    const result = buildPlayoffInitialization(league(qualifiers, size));
    assert.deepEqual(new Set(result.games.flatMap((game) => [game.homeUid, game.awayUid])), new Set(["u1", "u2", "u3", "u4"]));
  }
});

test("bracket retry is idempotent and live records cannot replace frozen seeds", () => {
  const initialized = buildPlayoffInitialization(league());
  const retry = buildPlayoffInitialization({ ...league(), status: "playoffs", postseason: initialized.postseason, liveStandings: [...qualifiers].reverse() });
  assert.equal(retry.alreadyInitialized, true);
  assert.deepEqual(retry.postseason.qualifiers, qualifiers);
  assert.deepEqual(retry.games, []);
});
