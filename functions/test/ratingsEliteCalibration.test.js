import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { generateRatingsPreview } from "../lib/generateRatingsPreview.js";
import { recalibrateRatingsPreviewPayload } from "../lib/recalibrateRatingsPreview.js";
import { percentileToRating, percentileToRatingElite } from "../shared/ratingNormalization.js";
import { generateRatingsV2Population, RATING_FORMULA_VERSION, RATING_FORMULA_VERSION_V2_0, RATING_FORMULA_VERSION_V2_1, RATING_FORMULA_VERSION_V2_2 } from "../shared/playerRatingsV2.js";

const positions = ["PG", "SG", "SF", "PF", "C"];
const players = Array.from({ length: 100 }, (_, index) => ({ id: `p${index}`, externalPlayerId: String(index), name: { full: `Player ${index}` }, primaryPosition: positions[index % 5], eligiblePositions: [positions[index % 5]], active: true }));
const stats = players.map((player, index) => {
  const tier = Math.floor(index / 5) / 19; const elite = Math.floor(index / 5) === 19;
  return { provider: "fixture", externalPlayerId: String(index), season: "2025", primaryPosition: player.primaryPosition, eligiblePositions: player.eligiblePositions,
    gamesPlayed: elite ? 78 : 45 + Math.round(tier * 30), gamesStarted: elite ? 78 : 15 + Math.round(tier * 50), minutesPerGame: elite ? 37 : 15 + tier * 19, totalMinutes: (elite ? 78 : 60) * (15 + tier * 19),
    pointsPerGame: 6 + tier * 25, assistsPerGame: 1 + tier * 10, turnoversPerGame: 3.8 - tier * 2.4, fieldGoalPercentage: .39 + tier * .2, threePointPercentage: .25 + tier * .2, threePointAttemptsPerGame: 1 + tier * 9, freeThrowPercentage: .58 + tier * .35, freeThrowAttemptsPerGame: 1 + tier * 9,
    offensiveReboundsPerGame: .2 + tier * 4, defensiveReboundsPerGame: 1 + tier * 10, stealsPerGame: .2 + tier * 2, blocksPerGame: .1 + tier * 3,
    usageRate: .12 + tier * .25, trueShootingPercentage: .45 + tier * .25, assistPercentage: .05 + tier * .45, turnoverPercentage: .24 - tier * .16, offensiveReboundPercentage: .02 + tier * .18, defensiveReboundPercentage: .06 + tier * .28,
    rimFrequency: .1 + tier * .55, rimEfficiency: .42 + tier * .32, midRangeFrequency: .03 + tier * .27, midRangeEfficiency: .28 + tier * .32, threePointFrequency: .1 + tier * .5, catchAndShootEfficiency: .25 + tier * .3, pullUpFrequency: .02 + tier * .35, pullUpEfficiency: .24 + tier * .34,
    driveFrequency: 1 + tier * 14, driveEfficiency: .45 + tier * .8, passingMetrics: { potentialAssists: 2 + tier * 18, passEfficiency: .4 + tier * .55, assistToTurnover: .5 + tier * 5 },
    trackingMetrics: { touches: 20 + tier * 80, rimContests: tier * 15, contestedReboundPercentage: .15 + tier * .65, reboundChanceConversion: .25 + tier * .65, transitionFrequency: .03 + tier * .3 },
    hustleMetrics: { deflections: .2 + tier * 5, contestedThreePointShots: .3 + tier * 8, looseBallsRecovered: .1 + tier * 2, activityRate: .15 + tier * .75 },
    defensiveDistanceMetrics: { rimOpponentEfficiency: .7 - tier * .3, perimeterOpponentEfficiency: .55 - tier * .25 },
  };
});

test("upper-tail attribute mapping separates elites without moving the middle", () => {
  assert.equal(percentileToRatingElite(.5), percentileToRating(.5));
  assert.ok(percentileToRatingElite(.98) > percentileToRating(.98));
  assert.ok(percentileToRatingElite(1) >= 98);
});

test("verified elite fixtures across every position exceed 90 and rare MVP fixtures exceed 95", () => {
  const results = generateRatingsV2Population({ players, seasonStats: stats }).results;
  for (const position of positions) {
    const elite = results.find((result) => result.playerId === `p${95 + positions.indexOf(position)}`);
    assert.equal(elite.ratingsStatus, "verified"); assert.ok(elite.overall >= 95, `${position}=${elite.overall}`);
  }
  assert.ok(results.filter((result) => result.overall >= 95).length < results.length);
});

test("low samples stay conservative and a one-skill specialist is not elite overall", () => {
  const inputPlayers = structuredClone(players); const inputStats = structuredClone(stats);
  inputStats[0] = { ...inputStats[99], externalPlayerId: "0", gamesPlayed: 3, gamesStarted: 0, minutesPerGame: 5, totalMinutes: 15 };
  inputStats[1] = { ...inputStats[1], threePointPercentage: .55, threePointAttemptsPerGame: 13, threePointFrequency: .8, catchAndShootEfficiency: .6, pullUpEfficiency: .58 };
  const byId = new Map(generateRatingsV2Population({ players: inputPlayers, seasonStats: inputStats }).results.map((result) => [result.playerId, result]));
  assert.equal(byId.get("p0").ratingsStatus, "insufficient_data"); assert.ok(byId.get("p0").overall < 85);
  assert.ok(byId.get("p1").ratings.threePoint >= 90); assert.ok(byId.get("p1").overall < 90);
});

test("calibration is deterministic, versioned, and avoids broad inflation", () => {
  const first = generateRatingsV2Population({ players, seasonStats: stats, generatedAt: "fixed" });
  assert.deepEqual(first, generateRatingsV2Population({ players, seasonStats: stats, generatedAt: "fixed" }));
  const legacy = generateRatingsV2Population({ players, seasonStats: stats, generatedAt: "fixed", formulaVersion: RATING_FORMULA_VERSION_V2_0 });
  const v21 = generateRatingsV2Population({ players, seasonStats: stats, generatedAt: "fixed", formulaVersion: RATING_FORMULA_VERSION_V2_1 });
  const v22 = generateRatingsV2Population({ players, seasonStats: stats, generatedAt: "fixed", formulaVersion: RATING_FORMULA_VERSION_V2_2 });
  assert.equal(legacy.results[0].ratingFormulaVersion, "ratings-v2.0.0"); assert.equal(first.results[0].ratingFormulaVersion, RATING_FORMULA_VERSION);
  const average = (rows) => rows.reduce((sum, row) => sum + row.overall, 0) / rows.length;
  assert.ok(average(first.results) < 90); assert.ok(first.results.some((result) => result.overall < 95)); assert.notDeepEqual(v21, legacy);
  assert.deepEqual(v22, generateRatingsV2Population({ players, seasonStats: stats, generatedAt: "fixed", formulaVersion: RATING_FORMULA_VERSION_V2_2 }));
});

test("local recalibration preserves its source, compares versions, and never imports a provider", async () => {
  const oldPreview = generateRatingsPreview({ players, seasonStats: stats, season: "2025", createdAt: "old", formulaVersion: RATING_FORMULA_VERSION_V2_0 });
  oldPreview.manifest.fetchManifest = { providerSchemaVersion: "nba-season-averages-v1", adapterVersion: "balldontlie-goat-import-v1" };
  const payload = { manifest: {}, players: players.map((player, index) => ({ player, seasonStats: stats[index] })), preview: oldPreview };
  const frozen = structuredClone(payload);
  const result = recalibrateRatingsPreviewPayload(payload, { createdAt: "new" });
  assert.deepEqual(payload, frozen); assert.notEqual(result.preview.manifest.importId, oldPreview.manifest.importId);
  assert.equal(result.manifest.recalibratedPlayerCount, players.length); assert.equal(result.manifest.skippedWithoutValidatedStats, 0);
  assert.equal(result.preview.manifest.formulaVersion, RATING_FORMULA_VERSION); assert.equal(result.preview.manifest.calibrationReview.status, "required");
  assert.ok(result.comparison.after.maximum >= result.comparison.before.maximum); assert.equal(result.preview.manifest.calibrationRealism.criticalIssues.length, 0);
  const source = await readFile(new URL("../lib/recalibrateRatingsPreview.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /createBalldontlieClient|fetchGoatRatingsPreview|playerCatalogs\/current/);
});
