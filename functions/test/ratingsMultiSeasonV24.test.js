import assert from "node:assert/strict";
import test from "node:test";
import { buildRatingWarningsV24, buildV24WarningReport, calibrateOverallV24 } from "../shared/playerRatingCalibrationV24.js";
import { adjustedSeasonWeights, buildShootingGravity, buildSustainedRatings, classifyMultiSeasonTrend } from "../shared/multiSeasonRatings.js";
import { generateRatingsV2Population, RATING_FORMULA_VERSION_V2_3, RATING_FORMULA_VERSION_V2_4 } from "../shared/playerRatingsV2.js";

const stats = (changes = {}) => ({ gamesPlayed: 72, gamesStarted: 70, totalMinutes: 2448, minutesPerGame: 34, pointsPerGame: 26, assistsPerGame: 6, turnoversPerGame: 2.5, fieldGoalPercentage: .49, threePointPercentage: .4, threePointAttemptsPerGame: 9, freeThrowPercentage: .9, freeThrowAttemptsPerGame: 5, usageRate: .29, trueShootingPercentage: .62, effectiveFieldGoalPercentage: .57, pullUpFrequency: .28, pullUpEfficiency: .55, catchAndShootEfficiency: .59, threePointFrequency: .5, trackingMetrics: { touches: 70 }, ...changes });
const ratings = (changes = {}) => ({ overall: 88, rimScoring: 82, midRange: 80, threePoint: 92, freeThrow: 92, playmaking: 86, ballHandling: 88, turnoverControl: 80, perimeterDefense: 78, interiorDefense: 65, steal: 76, block: 55, offensiveRebounding: 48, defensiveRebounding: 67, athleticism: 82, stamina: 88, consistency: 90, ...changes });
const confidence = (changes = {}) => ({ status: "verified", score: .9, coreCoverage: 1, advancedCoverage: .8, ...changes });

test("season weights favor current complete evidence and shift toward history for partial samples", () => {
  const full = adjustedSeasonWeights([{ stats: stats() }, { stats: stats() }, { stats: stats() }]);
  assert.deepEqual(full.map((item) => item.weight), [.6, .27, .13]);
  const partial = adjustedSeasonWeights([{ stats: stats({ gamesPlayed: 24, totalMinutes: 600, minutesPerGame: 25 }) }, { stats: stats() }, { stats: stats() }]);
  assert.deepEqual(partial.map((item) => item.weight), [.45, .36, .19]);
  const rookie = adjustedSeasonWeights([{ stats: stats({ gamesPlayed: 8, totalMinutes: 120, minutesPerGame: 15 }) }]);
  assert.equal(rookie[0].weight, 1);
});

test("persistent shooting and gravity use multi-season evidence deterministically", () => {
  const seasons = [{ stats: stats(), ratings: ratings() }, { stats: stats({ threePointAttemptsPerGame: 10 }), ratings: ratings({ threePoint: 94 }) }, { stats: stats({ threePointAttemptsPerGame: 8 }), ratings: ratings({ threePoint: 91 }) }];
  assert.ok(buildSustainedRatings(seasons).threePoint > 91);
  assert.ok(buildShootingGravity(seasons) >= .8);
  assert.equal(classifyMultiSeasonTrend(seasons), classifyMultiSeasonTrend(structuredClone(seasons)));
});

test("off-ball superstars receive an explicit role path while narrow role players do not", () => {
  const elite = calibrateOverallV24({ ratings: ratings(), stats: stats(), confidence: confidence(), historicalSeasons: [{ stats: stats(), ratings: ratings({ overall: 90 }) }, { stats: stats(), ratings: ratings({ overall: 89 }) }] });
  assert.equal(elite.internalRole, "OFF_BALL_SUPERSTAR"); assert.ok(elite.overall >= 88);
  const role = calibrateOverallV24({ ratings: ratings({ overall: 78, threePoint: 96, playmaking: 58, ballHandling: 60, rimScoring: 58 }), stats: stats({ pointsPerGame: 10, assistsPerGame: 1, usageRate: .14, minutesPerGame: 22, threePointAttemptsPerGame: 5 }), confidence: confidence(), historicalSeasons: [] });
  assert.notEqual(role.internalRole, "OFF_BALL_SUPERSTAR"); assert.ok(role.overall < 88);
});

test("verified repeated decline is distinguished from low-sample current noise", () => {
  const decline = [{ stats: stats({ pointsPerGame: 16, minutesPerGame: 26 }), ratings: ratings({ overall: 78 }) }, { stats: stats({ pointsPerGame: 23 }), ratings: ratings({ overall: 86 }) }, { stats: stats({ pointsPerGame: 28 }), ratings: ratings({ overall: 91 }) }];
  assert.match(classifyMultiSeasonTrend(decline), /DECLINE/);
  const partial = [{ stats: stats({ gamesPlayed: 9, totalMinutes: 160, minutesPerGame: 18, pointsPerGame: 14 }), ratings: ratings({ overall: 72 }) }, { stats: stats(), ratings: ratings({ overall: 90 }) }, { stats: stats(), ratings: ratings({ overall: 89 }) }];
  assert.equal(classifyMultiSeasonTrend(partial), "RETURNING_FROM_LIMITED_SAMPLE");
});

test("warning report groups explainable hierarchy contradictions and blocks critical issues", () => {
  const player = { playerId: "p", name: "Player", overall: 87, populationRank: 90, calibrationProfile: { trend: "SUSTAINED_ELITE", internalRole: "OFF_BALL_SUPERSTAR", shootingGravity: .9, sustainedDomains: { scoring: 92 }, seasonCount: 3 } };
  player.outliers = buildRatingWarningsV24(player, [player]); const report = buildV24WarningReport([player]);
  assert.ok(player.outliers.some((item) => item.code === "SUSTAINED_ELITE_UNDERRATED"));
  assert.ok(player.outliers.some((item) => item.code === "ROLE_RANK_CONTRADICTION"));
  assert.ok(report.groups.every((group) => group.title && group.explanation && group.suggestedArea)); assert.equal(report.approvalEligible, false);
});

test("V2.3 remains immutable while V2.4 consumes historical seasons", () => {
  const player = { id: "p", externalPlayerId: "1", primaryPosition: "PG", eligiblePositions: ["PG"] };
  const current = { ...stats(), provider: "fixture", season: "2025", externalPlayerId: "1", primaryPosition: "PG", eligiblePositions: ["PG"] };
  const prior = { ...current, season: "2024", pointsPerGame: 29 };
  const v23 = generateRatingsV2Population({ players: [player], seasonStats: [current], formulaVersion: RATING_FORMULA_VERSION_V2_3, generatedAt: "fixed" });
  assert.equal(v23.results[0].ratingFormulaVersion, "ratings-v2.3.0");
  assert.deepEqual(v23, generateRatingsV2Population({ players: [player], seasonStats: [current], formulaVersion: RATING_FORMULA_VERSION_V2_3, generatedAt: "fixed" }));
  const v24 = generateRatingsV2Population({ players: [player], seasonStats: [current], historicalSeasonStats: { previousSeason: [prior], twoSeasonsAgo: [{ ...prior, season: "2023" }] }, formulaVersion: RATING_FORMULA_VERSION_V2_4, generatedAt: "fixed" });
  assert.equal(v24.results[0].ratingFormulaVersion, "ratings-v2.4.0"); assert.equal(v24.results[0].calibrationProfile.seasonCount, 3);
});
