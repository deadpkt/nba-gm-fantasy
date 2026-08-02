import assert from "node:assert/strict";
import test from "node:test";
import { buildRatingOutliersV23, buildV23Domains, buildV23RealismReport, calibrateOverallV23, classifyRoleV23 } from "../shared/playerRatingCalibrationV23.js";
import { generateRatingsV2Population, RATING_FORMULA_VERSION_V2_2 } from "../shared/playerRatingsV2.js";

const ratings = (changes = {}) => ({ rimScoring: 82, midRange: 78, threePoint: 82, freeThrow: 82, playmaking: 82, ballHandling: 82, turnoverControl: 80, perimeterDefense: 80, interiorDefense: 78, steal: 80, block: 76, offensiveRebounding: 74, defensiveRebounding: 78, athleticism: 84, stamina: 86, consistency: 84, ...changes });
const stats = (changes = {}) => ({ provider: "fixture", externalPlayerId: "1", season: "2025", gamesPlayed: 72, gamesStarted: 68, minutesPerGame: 34, totalMinutes: 2448, pointsPerGame: 25, assistsPerGame: 6, turnoversPerGame: 2.4, fieldGoalPercentage: .5, threePointPercentage: .38, freeThrowPercentage: .84, freeThrowAttemptsPerGame: 6, usageRate: .29, trueShootingPercentage: .61, effectiveFieldGoalPercentage: .56, turnoverPercentage: .12, trackingMetrics: { touches: 72 }, driveFrequency: 10, ...changes });
const confidence = (changes = {}) => ({ status: "verified", score: .9, coreCoverage: 1, advancedCoverage: .8, ...changes });

test("superstar qualification requires independent multi-domain evidence", () => {
  const broad = calibrateOverallV23({ ratings: ratings({ rimScoring: 94, playmaking: 95, ballHandling: 94, perimeterDefense: 90 }), stats: stats({ pointsPerGame: 31, assistsPerGame: 9, usageRate: .34 }), confidence: confidence() });
  const narrow = calibrateOverallV23({ ratings: ratings({ threePoint: 99, rimScoring: 60, playmaking: 60, ballHandling: 62, perimeterDefense: 58, interiorDefense: 55, steal: 58, block: 50, offensiveRebounding: 48, defensiveRebounding: 55 }), stats: stats({ pointsPerGame: 13, assistsPerGame: 1, usageRate: .16, minutesPerGame: 25 }), confidence: confidence() });
  assert.equal(broad.starQualified, true); assert.ok(broad.overall >= 90); assert.equal(narrow.starQualified, false); assert.ok(narrow.overall < 85);
});

test("low-usage specialists preserve elite attributes but not star Overall", () => {
  const input = ratings({ threePoint: 99, playmaking: 60, ballHandling: 62, perimeterDefense: 70, interiorDefense: 52, block: 48, offensiveRebounding: 48, defensiveRebounding: 55 });
  const result = calibrateOverallV23({ ratings: input, stats: stats({ pointsPerGame: 11, assistsPerGame: 1.2, usageRate: .14, minutesPerGame: 23 }), confidence: confidence() });
  assert.equal(input.threePoint, 99); assert.ok(result.overall <= 82);
});

test("inefficient volume and provisional or low-minute evidence are controlled", () => {
  const inefficient = calibrateOverallV23({ ratings: ratings({ playmaking: 90, ballHandling: 90 }), stats: stats({ pointsPerGame: 30, usageRate: .35, trueShootingPercentage: .49, effectiveFieldGoalPercentage: .45, turnoverPercentage: .22, turnoversPerGame: 5 }), confidence: confidence() });
  const provisional = calibrateOverallV23({ ratings: ratings({ rimScoring: 96, playmaking: 96 }), stats: stats({ gamesPlayed: 10, minutesPerGame: 18, totalMinutes: 180 }), confidence: confidence({ status: "provisional", score: .45, advancedCoverage: .3 }) });
  assert.ok(inefficient.inefficientVolumePenalty > 0); assert.ok(inefficient.overall < 90); assert.ok(provisional.overall <= 80);
});

test("passing centers and two-way wings retain elite paths while defenders remain valuable", () => {
  const center = calibrateOverallV23({ ratings: ratings({ rimScoring: 94, playmaking: 97, ballHandling: 88, defensiveRebounding: 96, interiorDefense: 88 }), stats: stats({ pointsPerGame: 28, assistsPerGame: 10, usageRate: .31, trueShootingPercentage: .65 }), confidence: confidence() });
  const wing = calibrateOverallV23({ ratings: ratings({ rimScoring: 92, threePoint: 90, playmaking: 88, perimeterDefense: 96, interiorDefense: 88, steal: 94 }), stats: stats({ pointsPerGame: 27, assistsPerGame: 6, usageRate: .3, trueShootingPercentage: .62 }), confidence: confidence() });
  const defender = calibrateOverallV23({ ratings: ratings({ perimeterDefense: 98, steal: 96, threePoint: 78, playmaking: 64, ballHandling: 66 }), stats: stats({ pointsPerGame: 10, assistsPerGame: 2, usageRate: .15, minutesPerGame: 29 }), confidence: confidence() });
  assert.ok(center.overall >= 90); assert.ok(wing.overall >= 90); assert.ok(defender.overall >= 73 && defender.overall < 90);
});

test("correlated attributes form independent domains and role classification ignores OVR", () => {
  const domains = buildV23Domains(ratings({ interiorDefense: 96, block: 98, offensiveRebounding: 94, defensiveRebounding: 97 }));
  assert.equal(domains.eliteDomainCount, 2);
  const evidence = { workload: .7, roleEfficiency: .7, strongDomainCount: 3, responsibility: .8, independentSkillBreadth: .7, twoWayImpact: .5 };
  assert.equal(classifyRoleV23(evidence, stats(), confidence()), classifyRoleV23({ ...evidence, overall: 25 }, stats(), confidence()));
});

test("realism contradictions block approval", () => {
  const player = { playerId: "p", overall: 93, ratingsStatus: "provisional", populationRank: 2, normalizedInput: { minutesPerGame: 18 }, calibrationProfile: { role: "BENCH_PLAYER", tier: "TIER_A_PLUS", roleRange: [66, 75], starQualified: false, signals: { usage: .2, strongDomainCount: 1, responsibility: .2, roleEfficiency: .3, missingAdvanced: 6 } } };
  player.outliers = buildRatingOutliersV23(player, [player]); const report = buildV23RealismReport([player]);
  assert.ok(player.outliers.some((item) => item.reason === "ROLE_OVR_MISMATCH")); assert.ok(report.criticalIssues.length > 0); assert.equal(report.approvalEligible, false);
});

test("V2.2 remains deterministic and V2.3 preserves detailed attributes", () => {
  const player = { id: "p", externalPlayerId: "1", primaryPosition: "PG", eligiblePositions: ["PG"] }; const season = stats({ primaryPosition: "PG", eligiblePositions: ["PG"] });
  const v22 = generateRatingsV2Population({ players: [player], seasonStats: [season], generatedAt: "fixed", formulaVersion: RATING_FORMULA_VERSION_V2_2 });
  assert.deepEqual(v22, generateRatingsV2Population({ players: [player], seasonStats: [season], generatedAt: "fixed", formulaVersion: RATING_FORMULA_VERSION_V2_2 }));
  const v23 = generateRatingsV2Population({ players: [player], seasonStats: [season], generatedAt: "fixed" });
  for (const [key, value] of Object.entries(v22.results[0].ratings)) if (!["overall", "version", "source"].includes(key)) assert.equal(v23.results[0].ratings[key], value, key);
});
