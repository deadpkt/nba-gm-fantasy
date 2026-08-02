import assert from "node:assert/strict";
import test from "node:test";
import { createLiveGame, simulatePossession } from "../shared/liveSimulation.js";
import { deriveDefensiveAssignments, deriveTeamProfile, evaluateStrategyFit, STARTING_POSITIONS } from "../shared/teamIdentity.js";

const KEYS = ["overall", "rimScoring", "midRange", "threePoint", "freeThrow", "playmaking", "ballHandling", "turnoverControl", "perimeterDefense", "interiorDefense", "steal", "block", "offensiveRebounding", "defensiveRebounding", "athleticism", "stamina", "consistency"];
const baseByPosition = { PG: { playmaking: 82, ballHandling: 84, turnoverControl: 80 }, SG: { threePoint: 81, perimeterDefense: 74 }, SF: { threePoint: 76, perimeterDefense: 79 }, PF: { rimScoring: 77, interiorDefense: 78, defensiveRebounding: 79 }, C: { rimScoring: 80, interiorDefense: 84, block: 84, defensiveRebounding: 86 } };
function player(id, position, overrides = {}, verified = true) {
  const values = Object.fromEntries(KEYS.map((key) => [key, key === "overall" ? 78 : 70]));
  Object.assign(values, baseByPosition[position], overrides);
  values.overall = overrides.overall ?? Math.round(Object.values(values).reduce((sum, value) => sum + value, 0) / Object.values(values).length);
  if (!verified) return { id, name: id, position, primaryPosition: position, eligiblePositions: [position], overall: 75, ratingsVersion: 1, stats: { points: 15, rebounds: 5, assists: 4 } };
  return { id, name: id, position, primaryPosition: position, eligiblePositions: [position], overall: values.overall, ratingsVersion: 2, snapshotVersion: 2, ratings: { version: 2, source: "verified-season-stats:test", season: 2026, ...values }, stats: { points: 15, rebounds: 5, assists: 4 } };
}
function lineup(changes = {}, verified = true) { return Object.fromEntries(STARTING_POSITIONS.map((position) => [position, player(position.toLowerCase(), position, changes[position], verified)])); }

test("same lineup produces identical serializable output without mutating input", () => {
  const value = lineup(); const before = structuredClone(value);
  assert.deepEqual(deriveTeamProfile(value), deriveTeamProfile(value)); assert.deepEqual(value, before); assert.doesNotThrow(() => JSON.stringify(deriveTeamProfile(value)));
});
test("roles select elite specialists deterministically", () => {
  const profile = deriveTeamProfile(lineup({ PG: { playmaking: 98, ballHandling: 97, turnoverControl: 95 }, SG: { threePoint: 98, consistency: 94 }, SF: { perimeterDefense: 98, steal: 94 }, C: { interiorDefense: 98, block: 98, defensiveRebounding: 97 } }));
  assert.equal(profile.roleAssignments.primaryBallHandler, "pg"); assert.equal(profile.roleAssignments.floorSpacer, "sg"); assert.equal(profile.roleAssignments.perimeterStopper, "sf"); assert.equal(profile.roleAssignments.rimProtector, "c"); assert.equal(profile.roleAssignments.primaryRebounder, "c");
});
test("usage and every shot profile are normalized", () => {
  const profile = deriveTeamProfile(lineup()); assert.ok(Math.abs(Object.values(profile.usageWeights).reduce((a, b) => a + b, 0) - 1) < .00001);
  Object.values(profile.shotTendencies).forEach((values) => assert.ok(Math.abs(Object.values(values).reduce((a, b) => a + b, 0) - 1) < .00001));
});
test("balanced lineup fits better than same-talent all-scoring poor fit", () => {
  const balanced = deriveTeamProfile(lineup());
  const poor = deriveTeamProfile(lineup(Object.fromEntries(STARTING_POSITIONS.map((position) => [position, { rimScoring: 88, midRange: 88, threePoint: 88, playmaking: 38, ballHandling: 42, turnoverControl: 43, perimeterDefense: 40, interiorDefense: 40, block: 35, offensiveRebounding: 42, defensiveRebounding: 42, overall: 78 }]))));
  assert.ok(balanced.balance > poor.balance); assert.ok(poor.missingRoles.includes("secondary_creation"));
});
test("weak shooting and no playmaker expose stable weaknesses", () => {
  const poorSpacing = deriveTeamProfile(lineup(Object.fromEntries(STARTING_POSITIONS.map((position) => [position, { threePoint: 35 }])))); assert.ok(poorSpacing.spacing < 60); assert.ok(poorSpacing.missingRoles.includes("floor_spacing"));
  const noCreator = deriveTeamProfile(lineup(Object.fromEntries(STARTING_POSITIONS.map((position) => [position, { playmaking: 35, ballHandling: 37, turnoverControl: 40 }])))); assert.equal(noCreator.primaryWeakness, "limited_creation"); assert.ok(noCreator.warnings.includes("no_viable_ball_handler"));
});
test("controlled perimeter, paint, defense, rim, and rebounding fixtures separate team traits", () => {
  const perimeter = deriveTeamProfile(lineup(Object.fromEntries(STARTING_POSITIONS.map((position) => [position, { threePoint: 92, playmaking: 80 }]))));
  const paint = deriveTeamProfile(lineup(Object.fromEntries(STARTING_POSITIONS.map((position) => [position, { rimScoring: 92, threePoint: 50, offensiveRebounding: 82 }]))));
  const defense = deriveTeamProfile(lineup(Object.fromEntries(STARTING_POSITIONS.map((position) => [position, { perimeterDefense: 88, interiorDefense: 88, block: 84 }]))));
  assert.ok(perimeter.shooting > paint.shooting); assert.ok(paint.rimPressure > perimeter.rimPressure); assert.ok(defense.defense > perimeter.defense);
  const noRim = deriveTeamProfile(lineup(Object.fromEntries(STARTING_POSITIONS.map((position) => [position, { interiorDefense: 35, block: 35, defensiveRebounding: 40, athleticism: 45, consistency: 50 }]))));
  const noBoards = deriveTeamProfile(lineup(Object.fromEntries(STARTING_POSITIONS.map((position) => [position, { offensiveRebounding: 35, defensiveRebounding: 38 }]))));
  assert.ok(noRim.missingRoles.includes("rim_protection")); assert.ok(noBoards.missingRoles.includes("rebounding")); assert.ok(noBoards.warnings.includes("very_poor_rebounding"));
});
test("star-centric lineup has greater dependency than multiple creators", () => {
  const oneStar = deriveTeamProfile(lineup({ PG: Object.fromEntries(KEYS.map((key) => [key, 97])), SG: { rimScoring: 40, midRange: 40, threePoint: 40, playmaking: 35, ballHandling: 35 }, SF: { rimScoring: 40, midRange: 40, threePoint: 40 }, PF: { rimScoring: 40, midRange: 40, threePoint: 40 }, C: { rimScoring: 40, midRange: 40, threePoint: 40 } }));
  const creators = deriveTeamProfile(lineup({ PG: { playmaking: 92, ballHandling: 92 }, SG: { playmaking: 88, ballHandling: 88 }, SF: { playmaking: 84, ballHandling: 84 } })); assert.ok(oneStar.starDependency > creators.starDependency);
});
test("a passing center may earn a creator role", () => {
  const roles = deriveTeamProfile(lineup({ PG: { playmaking: 66, ballHandling: 68 }, SG: { playmaking: 62 }, SF: { playmaking: 61 }, PF: { playmaking: 60 }, C: { playmaking: 98, ballHandling: 91, turnoverControl: 94 } })).playerRoles.c;
  assert.ok(roles.includes("secondaryCreator") || roles.includes("primaryBallHandler"));
});
test("legacy and mixed lineups remain supported with explicit confidence", () => {
  const legacy = deriveTeamProfile(lineup({}, false)); assert.equal(legacy.valid, true); assert.equal(legacy.ratingsConfidence, "legacy"); assert.ok(legacy.warnings.includes("ratings_data_limited"));
  const mixed = lineup(); mixed.C = player("old-c", "C", {}, false); const result = deriveTeamProfile(mixed); assert.equal(result.ratingsConfidence, "mixed"); assert.deepEqual(result.versionComposition, { v1: 1, v2: 4 });
});
test("invalid, missing, duplicate, and malformed starters return validation results", () => {
  const missing = lineup(); missing.C = null; assert.equal(deriveTeamProfile(missing).valid, false);
  const duplicate = lineup(); duplicate.C = duplicate.PG; assert.ok(deriveTeamProfile(duplicate).errors.includes("duplicate_starter"));
  const malformed = lineup(); malformed.SG = { ...malformed.SG, ratings: { version: 2 } }; assert.ok(deriveTeamProfile(malformed).errors.some((error) => error.startsWith("malformed_ratings:")));
});
test("defensive assignments are unique, deterministic, and position-aware", () => {
  const defense = lineup({ SF: { perimeterDefense: 98 }, C: { interiorDefense: 98, block: 98 } }); const offense = lineup({ SG: { threePoint: 98, ballHandling: 94 }, C: { rimScoring: 98 } }); const first = deriveDefensiveAssignments(defense, offense);
  assert.deepEqual(first, deriveDefensiveAssignments(defense, offense)); assert.equal(new Set(Object.values(first)).size, 5);
});
test("strategy compatibility remains inactive and requires no persistence", () => {
  const result = evaluateStrategyFit(deriveTeamProfile(lineup()), { offense: "PACE_AND_SPACE", defense: "SWITCH_EVERYTHING" }); assert.equal(result.active, false); assert.ok(result.offense >= 25 && result.offense <= 99);
});
test("Simulation V1 possession behavior remains unchanged by Team Identity", () => {
  const snapshots = Object.values(lineup()).map((entry) => ({ ...entry, stats: { points: 15, rebounds: 5, assists: 4 } })); const values = [.1, .9, .2, .3, .4, .5]; let index = 0;
  const game = simulatePossession(createLiveGame(snapshots, snapshots), snapshots, snapshots, () => values[index++ % values.length]); assert.equal(game.possession, 1); assert.equal(game.events.at(-1).offensePlayerId, snapshots[0].id); assert.equal(game.events.at(-1).defensePlayerId, snapshots[4].id);
});
