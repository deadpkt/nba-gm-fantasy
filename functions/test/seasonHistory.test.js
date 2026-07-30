import assert from "node:assert/strict";
import test from "node:test";
import { buildOffseasonTransition, buildSeasonHistory, seasonHistoryMatches } from "../shared/seasonHistory.js";

const standings = [{ seed: 1, uid: "a", teamName: "Alpha", wins: 2, losses: 0 }, { seed: 2, uid: "b", teamName: "Beta", wins: 0, losses: 2 }];
const league = {
  id: "league", status: "playoffs", season: 1, maxMembers: 2, seasonConfig: { preset: "SHORT", gamesPerTeam: 2, scheduleVersion: 1 },
  regularSeasonResult: { season: 1, standings },
  postseason: { status: "completed", bracketVersion: 1, qualifiers: standings.map(({ seed, uid, teamName }) => ({ seed, uid, teamName })), champion: { seed: 1, uid: "a", teamName: "Alpha" }, runnerUp: { seed: 2, uid: "b", teamName: "Beta" }, completedAt: 100 },
};
const final = { id: "final", leagueId: "league", season: 1, stage: "final", status: "completed", homeUid: "a", homeTeamName: "Alpha", homeSeed: 1, awayUid: "b", awayTeamName: "Beta", awaySeed: 2, timeline: [{ text: "not copied" }], boxScore: { large: true }, result: { homeScore: 101, awayScore: 95, winnerUid: "a", loserUid: "b" } };

test("history cannot finalize before the trusted playoffs complete", () => {
  assert.throws(() => buildSeasonHistory({ league: { ...league, postseason: { ...league.postseason, status: "finals" } }, playoffGames: [final] }), /championship is not complete/);
});

test("completed Final preserves frozen standings and compact playoff summaries", () => {
  const history = buildSeasonHistory({ league, playoffGames: [final] });
  assert.deepEqual(history.regularSeason.standings, standings);
  assert.deepEqual([history.champion.uid, history.runnerUp.uid], ["a", "b"]);
  assert.equal(history.playoffs.games[0].home.score, 101);
  assert.equal("timeline" in history.playoffs.games[0], false);
  assert.equal("boxScore" in history.playoffs.games[0], false);
});

test("champion and runner-up must match the trusted Final", () => {
  assert.throws(() => buildSeasonHistory({ league, playoffGames: [{ ...final, result: { ...final.result, winnerUid: "b", loserUid: "a" } }] }), /does not match/);
});

test("identical retry is accepted but conflicting history is rejected", () => {
  const history = buildSeasonHistory({ league, playoffGames: [final] });
  assert.equal(seasonHistoryMatches({ ...history, createdAt: 200 }, buildSeasonHistory({ league, playoffGames: [final] })), true);
  assert.equal(seasonHistoryMatches({ ...history, champion: { ...history.champion, uid: "b" } }, history), false);
});

test("successful trusted finalization builds only the playoffs-to-offseason transition", () => {
  assert.deepEqual(buildOffseasonTransition(league, 200), {
    status: "offseason",
    offseason: { seasonCompleted: 1, nextSeason: 2, status: "open", preparationVersion: 1, readyMemberIds: [], startedAt: 200 },
    updatedAt: 200,
  });
  assert.throws(() => buildOffseasonTransition({ ...league, status: "regular_season" }, 200), /completed playoff season/);
});

test("later live team mutations cannot change an existing snapshot", () => {
  const history = buildSeasonHistory({ league, playoffGames: [final] });
  const mutatedTeam = { uid: "a", teamName: "Renamed Alpha" };
  assert.equal(history.champion.teamName, "Alpha");
  assert.notEqual(history.champion.teamName, mutatedTeam.teamName);
});
