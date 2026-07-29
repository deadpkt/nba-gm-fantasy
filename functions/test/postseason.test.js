import assert from "node:assert/strict";
import test from "node:test";
import { buildRegularSeasonFinalization, playoffQualifierCount } from "../shared/postseason.js";
import { calculateStandings } from "../shared/standings.js";

const teams = [
  { ownerUid: "alpha", name: "Alpha", record: { wins: 1, losses: 1 } },
  { ownerUid: "beta", name: "Beta", record: { wins: 1, losses: 1 } },
];
const league = {
  status: "regular_season",
  season: 1,
  maxMembers: 2,
  memberIds: ["alpha", "beta"],
  schedule: { totalGames: 2 },
  seasonConfig: { gamesPerTeam: 2 },
  seasonProgress: { regularSeasonComplete: true },
};

function completedGame(id, order, homeScore, awayScore, season = 1) {
  const homeWon = homeScore > awayScore;
  return {
    id, season, status: "completed", scheduledOrder: order, round: order, gameNumber: order,
    homeUid: "alpha", awayUid: "beta",
    result: {
      homeScore, awayScore,
      winnerUid: homeWon ? "alpha" : "beta",
      loserUid: homeWon ? "beta" : "alpha",
    },
  };
}

const games = [completedGame("g1", 1, 100, 90), completedGame("g2", 2, 80, 95)];

test("an incomplete schedule cannot finalize", () => {
  assert.throws(() => buildRegularSeasonFinalization({ league, teams, games: games.slice(0, 1), completedAt: "now" }), /schedule is incomplete/);
});

test("a completed schedule produces the same stable seed order as standings", () => {
  const result = buildRegularSeasonFinalization({ league, teams, games, completedAt: "now" });
  const expected = calculateStandings(teams, games, 1).map((row) => row.teamUid);
  assert.equal(result.alreadyFinalized, false);
  assert.deepEqual(result.regularSeasonResult.standings.map((row) => row.uid), expected);
  assert.deepEqual(result.regularSeasonResult.standings.map((row) => row.seed), [1, 2]);
});

test("playoff qualifier counts support every league size", () => {
  assert.deepEqual([2, 4, 6, 8].map(playoffQualifierCount), [2, 4, 4, 4]);
});

test("a retry reuses the frozen snapshot and qualifier field", () => {
  const first = buildRegularSeasonFinalization({ league, teams, games, completedAt: "first" });
  const retry = buildRegularSeasonFinalization({
    league: { ...league, regularSeasonResult: first.regularSeasonResult, postseason: first.postseason },
    teams,
    games: [],
    completedAt: "second",
  });
  assert.equal(retry.alreadyFinalized, true);
  assert.deepEqual(retry.regularSeasonResult, first.regularSeasonResult);
  assert.deepEqual(retry.postseason, first.postseason);
});

test("another season is ignored while malformed active-season games are rejected", () => {
  const oldGame = completedGame("old", 0, 150, 80, 0);
  assert.doesNotThrow(() => buildRegularSeasonFinalization({ league, teams, games: [...games, oldGame], completedAt: "now" }));
  const malformed = games.map((game, index) => index ? game : { ...game, result: null });
  assert.throws(() => buildRegularSeasonFinalization({ league, teams, games: malformed, completedAt: "now" }), /valid completed result/);
});

test("completion requires both regular-season status and completion metadata", () => {
  assert.throws(() => buildRegularSeasonFinalization({ league: { ...league, status: "season_ready" }, teams, games, completedAt: "now" }), /not in the regular season/);
  assert.throws(() => buildRegularSeasonFinalization({ league: { ...league, seasonProgress: { regularSeasonComplete: false } }, teams, games, completedAt: "now" }), /completion flag/);
});
