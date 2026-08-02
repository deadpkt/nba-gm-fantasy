import assert from "node:assert/strict";
import test from "node:test";
import { buildOfficialGameActivation, simulateOfficialGame, simulateOfficialGameV1 } from "../lib/completeOfficialGame.js";
import { assistProbability, blockProbability, createV2SeededRandom, deriveContest, normalizeDefensiveStrategy, normalizeOffensiveStrategy, reboundSideProbability, selectInitiator, selectRebounder, serializedV2GameSize, shotMakeProbability, simulateOfficialGameV2, turnoverProbability } from "../shared/officialSimulationV2.js";
import { deriveTeamProfile } from "../shared/teamIdentity.js";
import { teamDocument, v2Input, v2Players } from "./simulationV2Fixtures.js";

function analysisTeam(uid, players, opponent, strategy = {}) {
  const lineup = Object.fromEntries(players.map((player) => [player.assignedPosition, player])); const opponentLineup = Object.fromEntries(opponent.map((player) => [player.assignedPosition, player]));
  const profile = deriveTeamProfile(lineup, { opponentLineup });
  return { uid, players, profile, form: Object.fromEntries(players.map((player) => [player.id, 0])), offenseStrategy: normalizeOffensiveStrategy(strategy.offense), defenseStrategy: normalizeDefensiveStrategy(strategy.defense) };
}

test("same V2 seed and trusted inputs produce a deep-equal official result", () => { const input = v2Input(); assert.deepEqual(simulateOfficialGameV2(input), simulateOfficialGameV2(input)); });
test("different seeds produce bounded result variance", () => { const one = simulateOfficialGameV2(v2Input("one")); const two = simulateOfficialGameV2(v2Input("two")); assert.notDeepEqual(one.result, two.result); for (const score of [one.result.homeScore, one.result.awayScore, two.result.homeScore, two.result.awayScore]) assert.ok(score >= 25 && score <= 140); });
test("V1 dispatch preserves the frozen legacy fixture", () => {
  const roster = (prefix, overall) => ["PG", "SG", "SF", "PF", "C"].map((position, index) => ({ id: `${prefix}-${index}`, name: `${prefix} ${position}`, position, overall: overall + index, stats: { points: 20 + index, rebounds: 5 + index, assists: 4 + index } }));
  const team = (uid, prefix, overall) => { const players = roster(prefix, overall); return { ownerUid: uid, name: `${prefix} Team`, roster: players, lineup: Object.fromEntries(players.map((player) => [player.position, player.id])), strategy: "balanced" }; };
  const gameIdentity = { leagueId: "league-1", gameId: "game-1", season: 1, scheduleVersion: 1, homeUid: "home", awayUid: "away" }; const input = { gameIdentity, homeTeam: team("home", "H", 82), awayTeam: team("away", "A", 80) };
  assert.deepEqual(simulateOfficialGame(input), simulateOfficialGameV1(input)); assert.deepEqual(simulateOfficialGame(input).result, { homeScore: 26, awayScore: 18, winnerUid: "home", loserUid: "away" });
});
test("version dispatch requires verified V2 snapshots", () => {
  const players = v2Players("H"); const legacy = players.map((player) => ({ ...player, ratingsVersion: 1, ratings: { overall: 75 }, overall: 75 })); const homeTeam = teamDocument("home", legacy); const awayTeam = teamDocument("away", players);
  assert.throws(() => simulateOfficialGame({ gameIdentity: v2Input().gameIdentity, homeTeam, awayTeam, simulationVersion: 3 }), /not supported/);
  assert.throws(() => simulateOfficialGame({ gameIdentity: v2Input().gameIdentity, homeTeam, awayTeam, rosterSize: 5, simulationVersion: 2 }), /verified Ratings V2/);
});
test("trusted activation stores V2 pins and immutable input while default stays V1", () => {
  const home = v2Players("H"), away = v2Players("A"); const game = { ...v2Input().gameIdentity, id: "g", status: "scheduled" };
  const v1 = buildOfficialGameActivation({ game, homeTeam: teamDocument("home", home), awayTeam: teamDocument("away", away), startedAt: 1000, endsAt: 61000 }); assert.equal(v1.simulationVersion, 1); assert.equal("simulationInput" in v1, false);
  const v2 = buildOfficialGameActivation({ game, homeTeam: teamDocument("home", home), awayTeam: teamDocument("away", away), startedAt: 1000, endsAt: 61000, league: { seasonEngineVersions: { ratingsVersion: 2, simulationVersion: 2, eventSchemaVersion: 2, contractModelVersion: 1 } } }); assert.equal(v2.simulationVersion, 2); assert.equal(v2.eventSchemaVersion, 2); assert.equal(v2.simulationInput.seed, v2.boxScore.seedVersion === 2 ? v2.simulationInput.seed : null);
});
test("role hierarchy drives initiator selection", () => {
  const offensePlayers = v2Players("H", 65, { PG: { playmaking: 98, ballHandling: 98, turnoverControl: 96 } }); const defensePlayers = v2Players("A"); const team = analysisTeam("home", offensePlayers, defensePlayers); const random = createV2SeededRandom("initiators"); const counts = Object.fromEntries(offensePlayers.map((p) => [p.id, 0]));
  for (let i = 0; i < 500; i += 1) counts[selectInitiator(team, { progress: .25, clutch: false }, random).id] += 1; assert.equal(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0], "H-PG");
});
test("turnover and shot probabilities stay bounded", () => {
  const homePlayers = v2Players("H"), awayPlayers = v2Players("A"); const offense = analysisTeam("home", homePlayers, awayPlayers); const defense = analysisTeam("away", awayPlayers, homePlayers); const context = { progress: .5, clutch: false }; const initiator = homePlayers[0], defender = awayPlayers[0];
  const turnover = turnoverProbability({ offense, defense, initiator, defender, action: "PICK_AND_ROLL", context }); assert.ok(turnover >= .055 && turnover <= .225);
  const contest = deriveContest({ offense, defense, shooter: initiator, defender, zone: "ABOVE_BREAK_THREE", action: "PICK_AND_ROLL", context }); const shot = shotMakeProbability({ offense, defense, shooter: initiator, defender, zone: "ABOVE_BREAK_THREE", contest, context }); assert.ok(shot >= .18 && shot <= .61); assert.ok(["OPEN", "LIGHT", "CONTESTED", "HEAVILY_CONTESTED"].includes(contest.contestLevel));
});
test("assist attribution, block eligibility, and rebound rates are contextual", () => {
  const homePlayers = v2Players("H"), awayPlayers = v2Players("A"); const offense = analysisTeam("home", homePlayers, awayPlayers); const defense = analysisTeam("away", awayPlayers, homePlayers); const contest = { contestLevel: "LIGHT" };
  assert.ok(assistProbability({ offense, initiator: homePlayers[0], shooter: homePlayers[1], action: "SPOT_UP", contest }) > assistProbability({ offense, initiator: homePlayers[0], shooter: homePlayers[0], action: "ISOLATION", contest }));
  assert.equal(blockProbability({ defense, defender: awayPlayers[4], zone: "ABOVE_BREAK_THREE", contest }), 0); assert.ok(blockProbability({ defense, defender: awayPlayers[4], zone: "RIM", contest }) > 0);
  assert.ok(reboundSideProbability(offense, defense, "RIM", false) >= .14); const random = createV2SeededRandom("boards"); const counts = Object.fromEntries(homePlayers.map((p) => [p.id, 0])); for (let i = 0; i < 300; i += 1) counts[selectRebounder(offense, "defensive", "RIM", random).id] += 1; assert.ok(counts["H-C"] > counts["H-PG"]);
});
test("second chances, quarters, clocks, overtime metadata, and event schema reconcile", () => {
  const simulation = simulateOfficialGameV2(v2Input("structure", v2Players("H", 75, { offensiveRebounding: 95 }), v2Players("A", 65, { defensiveRebounding: 35 })));
  assert.ok(simulation.timeline.some((event, index, events) => event.reboundType === "offensive" && events[index + 1]?.possessionId === event.possessionId)); assert.deepEqual([...new Set(simulation.timeline.filter((e) => e.quarter <= 4).map((e) => e.quarter))], [1, 2, 3, 4]);
  assert.equal(simulation.timeline.at(-1).eventType, "game_end"); assert.equal(simulation.timeline.at(-1).presentationOffsetMs, 60000); assert.ok(simulation.timeline.every((event) => event.eventSchemaVersion === 2));
});
test("a tied regulation game enters deterministic overtime without a home tie-break", () => {
  const first = simulateOfficialGameV2(v2Input("ot-26")); const retry = simulateOfficialGameV2(v2Input("ot-26"));
  assert.ok(first.metrics.overtimePeriods >= 1); assert.notEqual(first.result.homeScore, first.result.awayScore); assert.ok(first.timeline.some((event) => event.quarter > 4)); assert.deepEqual(first, retry);
});
test("box score and timeline reconcile exactly", () => {
  const simulation = simulateOfficialGameV2(v2Input("reconcile")); const final = simulation.timeline.at(-1); assert.equal(final.homeScore, simulation.result.homeScore); assert.equal(final.awayScore, simulation.result.awayScore);
  for (const side of ["home", "away"]) { const team = simulation.boxScore[side]; assert.equal(team.players.reduce((n, p) => n + p.stats.points, 0), team.teamStats.points); assert.equal(team.players.reduce((n, p) => n + p.stats.fieldGoalsMade, 0), team.teamStats.fieldGoalsMade); assert.equal(team.players.reduce((n, p) => n + p.stats.threesMade, 0), team.teamStats.threesMade); assert.ok(team.teamStats.assists <= team.teamStats.fieldGoalsMade); }
});
test("strategy validation is safe and tradeoffs alter tendencies without overriding ratings", () => { assert.equal(normalizeOffensiveStrategy("nonsense"), "BALANCED"); assert.equal(normalizeDefensiveStrategy("nonsense"), "BALANCED"); const balanced = simulateOfficialGameV2(v2Input("strategy")); const perimeter = simulateOfficialGameV2(v2Input("strategy", v2Players("H"), v2Players("A"), { home: { offense: "PERIMETER_HEAVY", defense: "BALANCED" } })); assert.ok(perimeter.boxScore.home.teamStats.threesAttempted >= balanced.boxScore.home.teamStats.threesAttempted - 8); });
test("worst-case overtime-shaped game stays safely below Firestore document limit", () => { const simulation = simulateOfficialGameV2({ ...v2Input("size"), gameRules: { minimumPossessionsPerTeam: 70, maximumPossessionsPerTeam: 70, regulationPossessionsPerTeam: 70, overtimePossessionsPerTeam: 10 } }); assert.ok(serializedV2GameSize(simulation) < 700_000); });
