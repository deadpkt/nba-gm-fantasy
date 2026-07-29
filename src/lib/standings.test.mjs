import assert from "node:assert/strict";
import test from "node:test";
import { calculateStandings } from "./standings.js";

const teams = [
  { ownerUid: "alpha", name: "Alpha", record: { wins: 0, losses: 0 } },
  { ownerUid: "beta", name: "Beta", record: { wins: 0, losses: 0 } },
  { ownerUid: "gamma", name: "Gamma", record: { wins: 0, losses: 0 } },
];

function game({ id, round, homeUid, awayUid, homeScore, awayScore, season = 1, status = "completed" }) {
  const homeWon = homeScore > awayScore;
  return {
    id,
    round,
    gameNumber: round,
    scheduledOrder: round,
    season,
    status,
    homeUid,
    awayUid,
    result: status === "completed" ? {
      homeScore,
      awayScore,
      winnerUid: homeWon ? homeUid : awayUid,
      loserUid: homeWon ? awayUid : homeUid,
    } : null,
  };
}

test("no games returns every franchise at 0-0", () => {
  const rows = calculateStandings(teams, [], 1);
  assert.equal(rows.length, 3);
  rows.forEach((row) => assert.deepEqual(
    [row.gp, row.wins, row.losses, row.pointsFor, row.pointsAgainst, row.streak],
    [0, 0, 0, 0, 0, "-"],
  ));
});

test("one completed game calculates record, scoring, differential, and win percentage", () => {
  const rows = calculateStandings(teams, [game({ id: "g1", round: 1, homeUid: "alpha", awayUid: "beta", homeScore: 104, awayScore: 96 })], 1);
  const alpha = rows.find((row) => row.teamUid === "alpha");
  const beta = rows.find((row) => row.teamUid === "beta");
  assert.deepEqual([alpha.gp, alpha.wins, alpha.losses, alpha.winPercentage, alpha.pointsFor, alpha.pointsAgainst, alpha.pointDifferential, alpha.streak], [1, 1, 0, 1, 104, 96, 8, "W1"]);
  assert.deepEqual([beta.gp, beta.wins, beta.losses, beta.winPercentage, beta.pointsFor, beta.pointsAgainst, beta.pointDifferential, beta.streak], [1, 0, 1, 0, 96, 104, -8, "L1"]);
});

test("multiple rounds produce winning and losing streaks in schedule order", () => {
  const rows = calculateStandings(teams, [
    game({ id: "g3", round: 3, homeUid: "gamma", awayUid: "alpha", homeScore: 80, awayScore: 90 }),
    game({ id: "g1", round: 1, homeUid: "alpha", awayUid: "beta", homeScore: 100, awayScore: 90 }),
    game({ id: "g2", round: 2, homeUid: "beta", awayUid: "gamma", homeScore: 85, awayScore: 95 }),
  ], 1);
  assert.equal(rows.find((row) => row.teamUid === "alpha").streak, "W2");
  assert.equal(rows.find((row) => row.teamUid === "beta").streak, "L2");
});

test("ranking ties resolve by differential, points for, name, then uid", () => {
  const tiedTeams = [
    { ownerUid: "z", name: "Same" },
    { ownerUid: "a", name: "Same" },
    { ownerUid: "b", name: "Bravo" },
  ];
  assert.deepEqual(calculateStandings(tiedTeams, [], 1).map((row) => row.teamUid), ["b", "a", "z"]);
});

test("scheduled, in-progress, malformed, and another-season games are ignored", () => {
  const ignored = [
    game({ id: "scheduled", round: 1, homeUid: "alpha", awayUid: "beta", homeScore: 100, awayScore: 90, status: "scheduled" }),
    game({ id: "active", round: 2, homeUid: "alpha", awayUid: "beta", homeScore: 100, awayScore: 90, status: "in_progress" }),
    game({ id: "old", round: 3, homeUid: "alpha", awayUid: "beta", homeScore: 100, awayScore: 90, season: 2 }),
    { ...game({ id: "bad", round: 4, homeUid: "alpha", awayUid: "beta", homeScore: 100, awayScore: 90 }), result: null },
  ];
  calculateStandings(teams, ignored, 1).forEach((row) => assert.equal(row.gp, 0));
});
