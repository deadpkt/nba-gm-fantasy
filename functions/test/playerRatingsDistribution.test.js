import assert from "node:assert/strict";
import test from "node:test";
import { generateRatingsPreview, stageRatingsPreview } from "../lib/generateRatingsPreview.js";
import { detectRatingAnomalies } from "../shared/ratingAnomalies.js";
import { buildPlayerIdentityIndex, matchCanonicalPlayerIdentity } from "../shared/playerIdentity.js";
import { RATING_FORMULA_VERSION, generateRatingsV2Population, isValidRatingsV2 } from "../shared/playerRatingsV2.js";

const positions = ["PG", "SG", "SF", "PF", "C"];
const player = (index, primaryPosition = positions[index % 5]) => ({ id: `p${index}`, externalPlayerId: String(index), name: `Fixture ${index}`, primaryPosition, eligiblePositions: [primaryPosition], active: true });
const stats = (index, changes = {}) => ({
  provider: "fixture", externalPlayerId: String(index), season: "2025-26", gamesPlayed: 65, gamesStarted: 40, minutesPerGame: 27,
  pointsPerGame: 12 + index % 12, assistsPerGame: 2 + index % 6, turnoversPerGame: 1.5 + index % 4 * .4,
  fieldGoalPercentage: .43 + index % 8 * .01, threePointPercentage: .31 + index % 9 * .012, threePointAttemptsPerGame: 2 + index % 8,
  freeThrowPercentage: .68 + index % 10 * .025, freeThrowAttemptsPerGame: 2 + index % 5,
  offensiveReboundsPerGame: .4 + index % 5 * .6, defensiveReboundsPerGame: 2 + index % 8,
  stealsPerGame: .5 + index % 5 * .25, blocksPerGame: .15 + index % 6 * .25,
  usageRate: .16 + index % 10 * .015, trueShootingPercentage: .51 + index % 9 * .012, effectiveFieldGoalPercentage: .48 + index % 9 * .012,
  assistPercentage: .08 + index % 8 * .035, turnoverPercentage: .08 + index % 6 * .018,
  offensiveReboundPercentage: .02 + index % 6 * .018, defensiveReboundPercentage: .08 + index % 8 * .025,
  rimFrequency: .2 + index % 7 * .06, rimEfficiency: .52 + index % 8 * .025, midRangeFrequency: .08 + index % 5 * .04,
  midRangeEfficiency: .34 + index % 7 * .025, threePointFrequency: .2 + index % 7 * .07, threePointEfficiency: .31 + index % 9 * .012,
  catchAndShootFrequency: .12 + index % 6 * .05, catchAndShootEfficiency: .32 + index % 8 * .015,
  pullUpFrequency: .05 + index % 5 * .04, pullUpEfficiency: .31 + index % 7 * .018,
  driveFrequency: 2 + index % 9, driveEfficiency: .7 + index % 7 * .08, postUpFrequency: index % 5, postUpEfficiency: .6 + index % 6 * .08,
  passingMetrics: { potentialAssists: 3 + index % 10, passEfficiency: .6 + index % 6 * .06, assistToTurnover: 1.2 + index % 8 * .35 },
  trackingMetrics: { touches: 30 + index % 10 * 6, rimContests: index % 7, contestedReboundPercentage: .25 + index % 6 * .07, reboundChanceConversion: .4 + index % 6 * .07, transitionFrequency: .08 + index % 5 * .04 },
  hustleMetrics: { deflections: 1 + index % 7 * .45, contestedThreePointShots: 1 + index % 6, looseBallsRecovered: .3 + index % 5 * .2, activityRate: .3 + index % 8 * .07 },
  defensiveDistanceMetrics: { rimOpponentEfficiency: .48 + index % 7 * .025, perimeterOpponentEfficiency: .31 + index % 8 * .018 },
  primaryPosition: positions[index % 5], eligiblePositions: [positions[index % 5]],
  ...changes,
});
const population = (size = 75) => ({ players: Array.from({ length: size }, (_, index) => player(index)), seasonStats: Array.from({ length: size }, (_, index) => stats(index)) });

test("population Ratings V2 are deterministic, versioned, bounded, and explainable", () => {
  const input = population();
  const first = generateRatingsV2Population({ ...input, generatedAt: "2026-08-02T00:00:00.000Z" });
  assert.deepEqual(first, generateRatingsV2Population({ ...input, generatedAt: "2026-08-02T00:00:00.000Z" }));
  assert.equal(first.results[0].ratingFormulaVersion, RATING_FORMULA_VERSION);
  assert.ok(first.results.every((result) => isValidRatingsV2(result.ratings)));
  assert.ok(first.results[0].explanations.threePoint.signals.length > 0);
});

test("volume separates shooters and low-minute samples regress safely", () => {
  const input = population();
  input.seasonStats[1] = stats(1, { threePointPercentage: .42, threePointAttemptsPerGame: 10 });
  input.seasonStats[2] = stats(2, { threePointPercentage: .45, threePointAttemptsPerGame: .7 });
  input.seasonStats[3] = stats(3, { gamesPlayed: 2, gamesStarted: 0, minutesPerGame: 5, threePointPercentage: .8, threePointAttemptsPerGame: 1 });
  const byId = new Map(generateRatingsV2Population(input).results.map((result) => [result.playerId, result]));
  assert.ok(byId.get("p1").ratings.threePoint > byId.get("p2").ratings.threePoint);
  assert.ok(byId.get("p3").ratings.threePoint < 85);
  assert.equal(byId.get("p3").ratingsStatus, "insufficient_data");
});

test("anonymous specialists retain elite skills without automatic elite overall", () => {
  const input = population();
  input.seasonStats[4] = stats(4, { primaryPosition: "C", eligiblePositions: ["C"], blocksPerGame: 3.4, defensiveReboundPercentage: .3, defensiveReboundsPerGame: 11, defensiveDistanceMetrics: { rimOpponentEfficiency: .42, perimeterOpponentEfficiency: .4 }, trackingMetrics: { rimContests: 15, contestedReboundPercentage: .7, reboundChanceConversion: .78 } });
  input.players[4] = player(4, "C");
  input.seasonStats[5] = stats(5, { primaryPosition: "PG", eligiblePositions: ["PG"], pointsPerGame: 10, assistsPerGame: 12, assistPercentage: .48, passingMetrics: { potentialAssists: 20, passEfficiency: .9, assistToTurnover: 4.5 } });
  input.players[5] = player(5, "PG");
  const byId = new Map(generateRatingsV2Population(input).results.map((result) => [result.playerId, result]));
  assert.ok(byId.get("p4").ratings.block >= 88 && byId.get("p4").ratings.interiorDefense >= 85);
  assert.ok(byId.get("p5").ratings.playmaking >= 85);
  assert.ok(byId.get("p4").overall < byId.get("p4").ratings.block);
});

test("missing advanced categories produce provisional conservative ratings", () => {
  const input = population();
  input.seasonStats[6] = { provider: "fixture", externalPlayerId: "6", season: "2025-26", gamesPlayed: 25, gamesStarted: 4, minutesPerGame: 14, pointsPerGame: 8, assistsPerGame: 2, turnoversPerGame: 1, fieldGoalPercentage: .45, threePointPercentage: .34, threePointAttemptsPerGame: 2, freeThrowPercentage: .75, freeThrowAttemptsPerGame: 1, offensiveReboundsPerGame: 1, defensiveReboundsPerGame: 2, stealsPerGame: .5, blocksPerGame: .3, primaryPosition: "SG", eligiblePositions: ["SG"] };
  const result = generateRatingsV2Population(input).results.find((item) => item.playerId === "p6");
  assert.equal(result.ratingsStatus, "provisional");
  assert.ok(result.ratingsCoverage < .7);
});

test("preview manifest compares catalog, blocks publication, and records licensing checkpoint", () => {
  const input = population(30);
  const preview = generateRatingsPreview({ ...input, currentPlayers: input.players.map((item) => ({ ...item, overall: 75 })), season: "2025-26", createdAt: "2026-08-02T00:00:00.000Z" });
  assert.equal(preview.manifest.publication.enabled, false);
  assert.equal(preview.manifest.licensingCheckpoint.status, "required");
  assert.equal(preview.manifest.comparisonToCurrentCatalog.matchedPlayers, 30);
  assert.equal(preview.manifest.formulaVersion, RATING_FORMULA_VERSION);
});

test("anomaly detection catches low-confidence stars and contradictory profiles", () => {
  const result = { playerId: "x", externalPlayerId: "1", ratingsSeason: "2025-26", overall: 95, ratingsConfidence: { level: "low", totalMinutes: 20 }, normalizedInput: { season: "2025-26", primaryPosition: "PG", threePointAttemptsPerGame: 0, offensiveReboundsPerGame: 0, defensiveReboundsPerGame: 0, blocksPerGame: 0 }, ratings: { version: 2, source: "verified-season-stats:fixture", overall: 95, rimScoring: 70, midRange: 70, threePoint: 99, freeThrow: 70, playmaking: 70, ballHandling: 70, turnoverControl: 70, perimeterDefense: 70, interiorDefense: 95, steal: 70, block: 70, offensiveRebounding: 95, defensiveRebounding: 95, athleticism: 70, stamina: 70, consistency: 70 } };
  const report = detectRatingAnomalies([result]);
  assert.ok(report.criticalCount >= 2);
  assert.ok(report.anomalies.some((item) => item.code === "non-shooter-elite-three"));
});

test("synthetic league distribution is differentiated without broad inflation", () => {
  const results = generateRatingsV2Population(population(150)).results;
  const values = results.map((result) => result.overall);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  assert.ok(new Set(values).size >= 8);
  assert.ok(average >= 60 && average <= 82);
  assert.ok(values.filter((value) => value >= 95).length <= Math.ceil(values.length * .04));
  assert.ok(values.filter((value) => value >= 90).length <= Math.ceil(values.length * .15));
});

test("staging is admin-only", async () => {
  const preview = generateRatingsPreview({ ...population(10), season: "2025-26", createdAt: "2026-08-02T00:00:00.000Z" });
  await assert.rejects(() => stageRatingsPreview({ db: {}, auth: { uid: "member", token: {} }, preview }), /admin custom claim/i);
});

test("identity matching preserves canonical ids and queues ambiguous fallbacks", () => {
  const index = buildPlayerIdentityIndex([{ id: "legacy", name: "Stable Player", source: { provider: "balldontlie", externalId: 7 }, nbaPlayerId: "77" }]);
  assert.deepEqual(matchCanonicalPlayerIdentity({ identity: { id: "new", externalIds: [{ namespace: "balldontlie", value: "7" }] } }, index), { canonicalId: "legacy", method: "provider-external-identity", reviewRequired: false });
  assert.equal(matchCanonicalPlayerIdentity({ identity: { id: "new", externalIds: [] }, name: { full: "Stable Player" } }, index).reviewRequired, true);
});
