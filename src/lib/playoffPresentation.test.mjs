import assert from "node:assert/strict";
import test from "node:test";
import { playoffDisplayStatus, playoffUserOutcome, PLAYOFF_DISPLAY_STATUS, selectFeaturedPlayoffGame } from "./playoffPresentation.js";

const game = (overrides = {}) => ({ id: "sf1", stage: "semifinal", status: "scheduled", homeUid: "a", awayUid: "b", ...overrides });

test("hidden completed result remains live until authoritative game end", () => {
  const hidden = game({ status: "completed", timeline: [{ eventType: "game_end", presentationOffsetMs: 1000 }], presentation: { startedAt: 1000 } });
  assert.equal(playoffDisplayStatus(hidden, 1500), PLAYOFF_DISPLAY_STATUS.LIVE);
  assert.equal(playoffDisplayStatus(hidden, 2100), PLAYOFF_DISPLAY_STATUS.FINAL);
});

test("featured playoff matchup prioritizes the user's active game", () => {
  const final = game({ id: "final", stage: "final", homeUid: "c", awayUid: "d" });
  const own = game({ id: "sf2", homeUid: "a", awayUid: "c" });
  assert.equal(selectFeaturedPlayoffGame([final, own], "a").id, "sf2");
});

test("featured playoff matchup falls back to the active Final", () => {
  const semifinal = game({ status: "completed", result: { winnerUid: "a", loserUid: "b", homeScore: 90, awayScore: 80 } });
  const final = game({ id: "final", stage: "final", homeUid: "c", awayUid: "d" });
  assert.equal(selectFeaturedPlayoffGame([semifinal, final], "x").id, "final");
});

test("elimination labels never invent an exact placement", () => {
  const postseason = { qualifiers: [{ uid: "a" }, { uid: "b" }, { uid: "c" }, { uid: "d" }] };
  const result = playoffUserOutcome({ postseason, uid: "b", games: [game({ status: "completed", result: { winnerUid: "a", loserUid: "b", homeScore: 90, awayScore: 80 } })] });
  assert.deepEqual(result, { state: "eliminated", label: "ELIMINATED", finish: "Semifinalist" });
});

test("trusted champion and runner-up identities drive final outcomes", () => {
  const postseason = { status: "completed", qualifiers: [{ uid: "a" }, { uid: "b" }], champion: { uid: "a" }, runnerUp: { uid: "b" } };
  assert.equal(playoffUserOutcome({ postseason, uid: "a" }).state, "champion");
  assert.equal(playoffUserOutcome({ postseason, uid: "b" }).finish, "Runner-Up");
});
