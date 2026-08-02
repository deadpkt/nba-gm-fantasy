import assert from "node:assert/strict";
import test from "node:test";
import { buildRatingOutliers, calibrateOverallV22 } from "../shared/playerRatingCalibration.js";
import { compareOptionalRatingBenchmark } from "../shared/ratingBenchmark.js";

const ratings = (overrides = {}) => ({ rimScoring: 82, midRange: 78, threePoint: 82, freeThrow: 82, playmaking: 82, ballHandling: 82, turnoverControl: 80, perimeterDefense: 80, interiorDefense: 78, steal: 80, block: 76, offensiveRebounding: 74, defensiveRebounding: 78, athleticism: 84, stamina: 86, consistency: 84, ...overrides });
const stats = (overrides = {}) => ({ gamesPlayed: 70, gamesStarted: 0, minutesPerGame: 34, pointsPerGame: 25, assistsPerGame: 6, turnoversPerGame: 2.5, fieldGoalPercentage: .5, threePointPercentage: .38, freeThrowPercentage: .86, freeThrowAttemptsPerGame: 6, rimEfficiency: .66, driveFrequency: 13, trackingMetrics: { touches: 72 }, ...overrides });
const confidence = (overrides = {}) => ({ status: "verified", score: .9, coverage: 1, ...overrides });

test("superstar profile reaches an elite tier while a starter does not become MVP level", () => {
  const star = calibrateOverallV22({ ratings: ratings({ playmaking: 96, ballHandling: 95, rimScoring: 94, perimeterDefense: 88 }), stats: stats({ pointsPerGame: 31, assistsPerGame: 8 }), confidence: confidence(), baseOverall: 90 });
  const starter = calibrateOverallV22({ ratings: ratings(), stats: stats({ pointsPerGame: 16, assistsPerGame: 3, minutesPerGame: 31 }), confidence: confidence(), baseOverall: 82 });
  assert.ok(star.overall >= 95); assert.equal(star.tier, "TIER_S"); assert.ok(starter.overall < 90);
});

test("specialists keep elite skills without superstar overall and low-minute outliers regress", () => {
  const specialistRatings = ratings({ threePoint: 98, playmaking: 62, ballHandling: 65, interiorDefense: 58, block: 55, offensiveRebounding: 52, defensiveRebounding: 58 });
  const specialist = calibrateOverallV22({ ratings: specialistRatings, stats: stats({ minutesPerGame: 22, pointsPerGame: 12, assistsPerGame: 1.5 }), confidence: confidence(), baseOverall: 82 });
  const tiny = calibrateOverallV22({ ratings: ratings({ block: 99, interiorDefense: 96 }), stats: stats({ gamesPlayed: 8, minutesPerGame: 9, pointsPerGame: 5 }), confidence: confidence({ status: "provisional", score: .35 }), baseOverall: 88 });
  assert.equal(specialistRatings.threePoint, 98); assert.ok(specialist.overall < 90); assert.ok(tiny.overall <= 70);
});

test("inefficient volume is limited while passing centers, two-way wings, and defenders retain value", () => {
  const inefficient = calibrateOverallV22({ ratings: ratings({ playmaking: 88, ballHandling: 88 }), stats: stats({ pointsPerGame: 29, fieldGoalPercentage: .39, threePointPercentage: .27, freeThrowPercentage: .62, turnoversPerGame: 5 }), confidence: confidence(), baseOverall: 87 });
  const passingCenter = calibrateOverallV22({ ratings: ratings({ playmaking: 96, defensiveRebounding: 94, rimScoring: 90, interiorDefense: 86 }), stats: stats({ pointsPerGame: 24, assistsPerGame: 9 }), confidence: confidence(), baseOverall: 88 });
  const twoWayWing = calibrateOverallV22({ ratings: ratings({ rimScoring: 90, threePoint: 88, perimeterDefense: 94, interiorDefense: 88, steal: 92 }), stats: stats(), confidence: confidence(), baseOverall: 88 });
  const defender = calibrateOverallV22({ ratings: ratings({ perimeterDefense: 97, steal: 95, threePoint: 79, playmaking: 68 }), stats: stats({ pointsPerGame: 11, assistsPerGame: 2 }), confidence: confidence(), baseOverall: 83 });
  assert.ok(inefficient.overall < 95); assert.ok(passingCenter.overall >= 90); assert.ok(twoWayWing.overall >= 88); assert.ok(defender.overall >= 78 && defender.overall < 90);
});

test("outlier queue detects critical role mismatch and benchmark comparison never overwrites ratings", () => {
  const player = { playerId: "p1", name: "Fixture", overall: 92, ratingsStatus: "verified", normalizedInput: { minutesPerGame: 18 }, calibrationProfile: { role: "BENCH_PLAYER", tier: "TIER_A_PLUS", roleCap: 78, starQualified: false, signals: { eliteSkillsCount: 1, strongSkillsCount: 1, responsibility: .2, efficiencyAtRole: .5 } }, calibrationDiagnostics: { missingAttributes: [] } };
  const outliers = buildRatingOutliers(player); assert.ok(outliers.some((item) => item.severity === "CRITICAL" && item.reason === "ROLE_OVR_MISMATCH"));
  const comparison = compareOptionalRatingBenchmark([player], [{ playerId: "p1", benchmarkOverall: 80, benchmarkSource: "licensed-fixture", benchmarkSeason: "2025" }]);
  assert.equal(comparison.matchedCount, 1); assert.equal(comparison.meanAbsoluteDifference, 12); assert.equal(player.overall, 92);
});
