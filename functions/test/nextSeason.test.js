import assert from "node:assert/strict";
import test from "node:test";
import { buildNextSeasonTransition, isNextSeasonCommissioner, isNextSeasonTransitionRetry, NEXT_SEASON_FIELDS_TO_CLEAR } from "../shared/nextSeason.js";
import { generateRegularSeasonSchedule } from "../../src/lib/schedule.js";
import { calculateStandings } from "../shared/standings.js";

const roster = ["PG", "SG", "SF", "PF", "C"].map((position) => ({ id: position.toLowerCase(), position }));
const lineup = Object.fromEntries(roster.map((player) => [player.position, player.id]));
const teams = ["a", "b"].map((uid) => ({ id: uid, ownerUid: uid, roster, lineup, record: { wins: 4, losses: 2 } }));
const history = { season: 1, status: "completed", champion: { uid: "a" } };
const league = { status: "offseason", season: 1, maxMembers: 2, commissionerUid: "a", memberIds: ["a", "b"], offseason: { seasonCompleted: 1, nextSeason: 2, status: "open", readyMemberIds: ["a", "b"], startedAt: 10 } };

test("only the commissioner is authorized for the trusted transition", () => {
  assert.equal(isNextSeasonCommissioner(league, "a"), true);
  assert.equal(isNextSeasonCommissioner(league, "b"), false);
});

test("trusted transition prepares Season 2 without mutating carryover data", () => {
  const rosterBefore = JSON.stringify(teams.map((team) => team.roster));
  const historyBefore = JSON.stringify(history);
  const result = buildNextSeasonTransition({ league, history, teams, transitionedAt: 20 });
  assert.equal(result.targetSeason, 2);
  assert.equal(result.leagueUpdate.status, "season_ready");
  assert.deepEqual(result.leagueUpdate.seasonReadyMemberIds, ["a", "b"]);
  assert.ok(["regularSeasonResult", "postseason", "seasonProgress", "schedule", "offseason"].every((field) => result.fieldsToClear.includes(field)));
  assert.ok(result.teamUpdates.every((team) => team.record.wins === 0 && team.record.losses === 0));
  assert.equal(JSON.stringify(teams.map((team) => team.roster)), rosterBefore);
  assert.equal(JSON.stringify(history), historyBefore);
});

test("unready, stale, and malformed franchises block transition", () => {
  assert.throws(() => buildNextSeasonTransition({ league: { ...league, offseason: { ...league.offseason, readyMemberIds: ["a"] } }, history, teams, transitionedAt: 20 }), /Every current franchise/);
  assert.throws(() => buildNextSeasonTransition({ league: { ...league, offseason: { ...league.offseason, nextSeason: 3 } }, history, teams, transitionedAt: 20 }), /does not target/);
  assert.throws(() => buildNextSeasonTransition({ league, history, teams: [{ ...teams[0], roster: [] }, teams[1]], transitionedAt: 20 }), /configured roster and valid Starting Five/);
  assert.throws(() => buildNextSeasonTransition({ league, history, teams: [{ ...teams[0], lineup: { ...lineup, C: "pg" } }, teams[1]], transitionedAt: 20 }), /configured roster and valid Starting Five/);
});

test("retry marker cannot increment Season 2 directly to Season 3", () => {
  const transition = buildNextSeasonTransition({ league, history, teams, transitionedAt: 20 });
  assert.equal(isNextSeasonTransitionRetry({ ...transition.leagueUpdate }), true);
  assert.throws(() => buildNextSeasonTransition({ league: { ...league, status: "season_ready", season: 2 }, history, teams, transitionedAt: 30 }), /not in offseason/);
});

test("generic transition supports Season 2 to Season 3", () => {
  const seasonTwo = { ...league, season: 2, offseason: { ...league.offseason, seasonCompleted: 2, nextSeason: 3 } };
  assert.equal(buildNextSeasonTransition({ league: seasonTwo, history: { ...history, season: 2 }, teams, transitionedAt: 30 }).targetSeason, 3);
});

test("version two preparation requires eight roster players and preserves five-player simulation lineup", () => {
  const rosterV2 = [...roster, { id: "bench-pg", position: "PG" }, { id: "bench-f", position: "SF" }, { id: "bench-c", position: "C" }];
  const leagueV2 = { ...league, rosterConfig: { version: 2, rosterSize: 8, starterCount: 5, benchSize: 3 } };
  const teamsV2 = teams.map((team) => ({ ...team, roster: rosterV2 }));
  assert.doesNotThrow(() => buildNextSeasonTransition({ league: leagueV2, history, teams: teamsV2, transitionedAt: 20 }));
  assert.throws(() => buildNextSeasonTransition({ league: leagueV2, history, teams: [{ ...teamsV2[0], roster: rosterV2.slice(0, 7) }, teamsV2[1]], transitionedAt: 20 }), /configured roster/);
});

test("only live competition fields are cleared", () => {
  assert.equal(NEXT_SEASON_FIELDS_TO_CLEAR.includes("memberIds"), false);
  assert.equal(NEXT_SEASON_FIELDS_TO_CLEAR.includes("seasonConfig"), false);
  assert.equal(NEXT_SEASON_FIELDS_TO_CLEAR.includes("playerOwnership"), false);
  assert.equal(NEXT_SEASON_FIELDS_TO_CLEAR.includes("games"), false);
});

test("Season 2 schedule IDs cannot collide with Season 1", () => {
  const input = { leagueId: "league", memberIds: ["a", "b"], seasonConfig: { preset: "SHORT", gamesPerTeam: 2, scheduleVersion: 1 }, teamNames: { a: "Alpha", b: "Beta" } };
  const seasonOne = generateRegularSeasonSchedule({ ...input, season: 1 });
  const seasonTwo = generateRegularSeasonSchedule({ ...input, season: 2 });
  assert.ok(seasonOne.games.every((game) => game.id.startsWith("s001-")));
  assert.ok(seasonTwo.games.every((game) => game.id.startsWith("s002-")));
  assert.equal(seasonTwo.games.some((game) => seasonOne.games.some((oldGame) => oldGame.id === game.id)), false);
});

test("Season 2 standings ignore retained Season 1 games", () => {
  const oldGame = { id: "s001", season: 1, stage: "regular_season", status: "completed", homeUid: "a", awayUid: "b", result: { homeScore: 100, awayScore: 90, winnerUid: "a", loserUid: "b" } };
  const standings = calculateStandings(teams, [oldGame], 2);
  assert.ok(standings.every((row) => row.gp === 0 && row.wins === 0 && row.losses === 0));
});
