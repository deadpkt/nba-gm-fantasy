import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildRatingWarningsV241, buildRobustDomainsV241, buildWarningResolutionV241, calibrateOverallV241, classifyShootingArchetypeV241, sustainedEliteEvidenceV241 } from "../shared/playerRatingCalibrationV241.js";
import { generateRatingsV2Population, RATING_FORMULA_VERSION, RATING_FORMULA_VERSION_V2_4 } from "../shared/playerRatingsV2.js";

const ratings = (changes = {}) => ({ overall: 87, rimScoring: 80, midRange: 60, threePoint: 94, freeThrow: 92, playmaking: 84, ballHandling: 87, turnoverControl: 52, perimeterDefense: 75, interiorDefense: 60, steal: 72, block: 50, offensiveRebounding: 45, defensiveRebounding: 62, athleticism: 80, stamina: 86, consistency: 88, ...changes });
const stats = (changes = {}) => ({ gamesPlayed: 72, gamesStarted: 70, totalMinutes: 2448, minutesPerGame: 34, pointsPerGame: 27, assistsPerGame: 6, turnoversPerGame: 3.2, fieldGoalPercentage: .48, threePointPercentage: .41, threePointAttemptsPerGame: 11, freeThrowPercentage: .91, freeThrowAttemptsPerGame: 5, usageRate: .3, trueShootingPercentage: .62, threePointFrequency: .58, pullUpFrequency: .28, pullUpEfficiency: .42, catchAndShootEfficiency: .45, driveFrequency: 8, trackingMetrics: { touches: 72 }, ...changes });
const confidence = (changes = {}) => ({ status: "verified", score: .9, coreCoverage: 1, advancedCoverage: .8, ...changes });

test("missing optional midrange does not act as an observed weak rating", () => {
  const missing = buildRobustDomainsV241(ratings(), stats({ midRangeEfficiency: null, midRangeFrequency: null }));
  const weak = buildRobustDomainsV241(ratings(), stats({ midRangeEfficiency: .28, midRangeFrequency: .2 }));
  assert.ok(missing.scoring > weak.scoring);
});

test("turnover control is adjusted for verified creation responsibility without rewarding recklessness", () => {
  const highBurden = buildRobustDomainsV241(ratings(), stats());
  const reckless = buildRobustDomainsV241(ratings(), stats({ turnoversPerGame: 6, assistsPerGame: 2, usageRate: .35, trackingMetrics: { touches: 80 } }));
  assert.ok(highBurden.responsibilityAdjustedTurnover > ratings().turnoverControl); assert.ok(reckless.creation < highBurden.creation);
});

test("off-ball superstar path requires verified multi-season evidence", () => {
  const domains = { scoring: 86, creation: 78 };
  assert.equal(classifyShootingArchetypeV241({ gravity: .8, domains, workload: .7, confidence: confidence(), seasonCount: 3, sustainedEliteEvidence: .7 }), "OFF_BALL_SUPERSTAR");
  assert.notEqual(classifyShootingArchetypeV241({ gravity: .8, domains, workload: .25, confidence: confidence({ status: "provisional" }), seasonCount: 1, sustainedEliteEvidence: .2 }), "OFF_BALL_SUPERSTAR");
});

test("sustained evidence supports stars but repeated decline reduces it", () => {
  const seasons = [0, 1, 2].map(() => ({ stats: stats(), ratings: ratings(), confidence: confidence() })); const domains = { scoring: 88, creation: 84, perimeterDefense: 76, interiorDefense: 62, rebounding: 65 };
  const stable = sustainedEliteEvidenceV241({ seasons, robustDomains: domains, shootingGravity: .8, trend: "STABLE", confidence: confidence() });
  const declining = sustainedEliteEvidenceV241({ seasons, robustDomains: domains, shootingGravity: .8, trend: "SHARP_DECLINE", confidence: confidence() });
  assert.ok(stable > declining);
});

test("calibration preserves low-sample caps and does not inflate a spot-up specialist", () => {
  const result = calibrateOverallV241({ ratings: ratings({ overall: 79, playmaking: 58, ballHandling: 60 }), stats: stats({ gamesPlayed: 10, totalMinutes: 180, minutesPerGame: 18, assistsPerGame: 1, usageRate: .13 }), confidence: confidence({ status: "provisional", score: .4 }), historicalSeasons: [] });
  assert.ok(result.overall <= 83); assert.notEqual(result.internalRole, "OFF_BALL_SUPERSTAR");
});

test("single elite defensive domain is not mislabeled as an underrated overall profile", () => {
  const player = { playerId: "c", overall: 76, ratingsStatus: "verified", calibrationProfile: { robustDomains: { scoring: 65, creation: 64, perimeterDefense: 70, interiorDefense: 94, rebounding: 86 }, shootingGravity: .1, sustainedEliteEvidence: .2, internalRole: "SPECIALIST", seasonCount: 3 } };
  assert.deepEqual(buildRatingWarningsV241(player), []);
});

test("warning resolution tracks resolved and unresolved findings", () => {
  const previous = [{ playerId: "p", name: "Player", overall: 80, outliers: [{ code: "ELITE_SKILL_PROFILE_UNDERRATED" }] }];
  const next = [{ playerId: "p", overall: 81, ratingsStatus: "verified", outliers: [], calibrationProfile: { role: "HIGH_LEVEL_STARTER", internalRole: "HIGH_LEVEL_STARTER", trend: "STABLE", seasonCount: 3 } }];
  assert.equal(buildWarningResolutionV241(previous, next)[0].status, "resolved");
  next[0].outliers = [{ code: "ELITE_SKILL_PROFILE_UNDERRATED" }]; assert.equal(buildWarningResolutionV241(previous, next)[0].status, "unresolved");
});

test("V2.4 remains deterministic and V2.4.1 is separately versioned", () => {
  const player = { id: "p", externalPlayerId: "1", primaryPosition: "PG", eligiblePositions: ["PG"] }; const season = { ...stats(), provider: "fixture", season: "2025", externalPlayerId: "1", primaryPosition: "PG", eligiblePositions: ["PG"] };
  const old = generateRatingsV2Population({ players: [player], seasonStats: [season], formulaVersion: RATING_FORMULA_VERSION_V2_4, generatedAt: "fixed" });
  assert.deepEqual(old, generateRatingsV2Population({ players: [player], seasonStats: [season], formulaVersion: RATING_FORMULA_VERSION_V2_4, generatedAt: "fixed" })); assert.equal(old.results[0].ratingFormulaVersion, "ratings-v2.4.0");
  const next = generateRatingsV2Population({ players: [player], seasonStats: [season], formulaVersion: RATING_FORMULA_VERSION, generatedAt: "fixed" }); assert.equal(next.results[0].ratingFormulaVersion, "ratings-v2.4.1");
});

test("Admin review exposes warning resolution and recalibration has no provider dependency", async () => {
  const admin = await readFile(new URL("../../src/pages/AdminRatingsPreviewPage.jsx", import.meta.url), "utf8");
  const recalibration = await readFile(new URL("../lib/recalibrateRatingsPreview.js", import.meta.url), "utf8");
  assert.match(admin, /Warning resolution/); assert.match(admin, /Root cause filter/); assert.match(admin, /Resolution filter/); assert.match(admin, /shootingGravity/);
  assert.doesNotMatch(recalibration, /createBalldontlieClient|fetchGoatRatingsPreview|playerCatalogs\/current/);
});
