import assert from "node:assert/strict";
import test from "node:test";
import { deriveRaceInsight, formatGamesBehind, gamesBehind, visibleStandingsGames } from "./standingsRace.js";

const rows = [
  { teamUid: "a", teamName: "Alpha", rank: 1, wins: 6, losses: 2 },
  { teamUid: "b", teamName: "Beta", rank: 2, wins: 5, losses: 3 },
  { teamUid: "c", teamName: "Court", rank: 3, wins: 4, losses: 4 },
];

test("games behind uses the standard standings formula", () => {
  assert.equal(gamesBehind(rows[0], rows[1]), 1);
  assert.equal(gamesBehind(rows[0], rows[0]), 0);
  assert.equal(formatGamesBehind(0, true), "—");
  assert.equal(formatGamesBehind(1), "1.0");
  assert.equal(formatGamesBehind(0.5), "0.5");
});

test("race insight reports real record ties first", () => {
  const tied = [...rows, { teamUid: "d", teamName: "Delta", rank: 4, wins: 4, losses: 4 }];
  assert.equal(deriveRaceInsight(tied, 2, "a"), "2 franchises are tied at 4-4.");
});

test("race insight reports a real playoff-line margin", () => {
  assert.equal(deriveRaceInsight(rows, 2, "b"), "Beta are 1.0 games above the playoff line.");
});

test("race insight stays empty when there is no meaningful race", () => {
  assert.equal(deriveRaceInsight([rows[0]], 1, "a"), "");
  assert.equal(deriveRaceInsight(rows.map((row) => ({ ...row, gp: 0 })), 2, "a"), "");
});

test("standings visibility excludes a completed result until authoritative presentation end", () => {
  const game = { status: "completed", timeline: [{ eventType: "game_end", presentationOffsetMs: 1000 }], presentation: { startedAt: 1000 } };
  assert.equal(visibleStandingsGames([game], 1500).length, 0);
  assert.equal(visibleStandingsGames([game], 2100).length, 1);
});
