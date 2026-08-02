import { RATINGS_VERSION_V1, RATINGS_VERSION_V2 } from "./engineVersions.js";
import { normalizeSeasonStatRecord } from "./seasonStats.js";
import { buildPopulationNormalizer, clampRating, percentileToRating, percentileToRatingElite } from "./ratingNormalization.js";
import { calculateRatingsConfidenceV2 } from "./ratingConfidence.js";
import { buildRatingOutliers, calibrateOverallV22 } from "./playerRatingCalibration.js";
import { buildRatingOutliersV23, buildV23RealismReport, calibrateOverallV23 } from "./playerRatingCalibrationV23.js";
import { buildRatingWarningsV24, buildV24WarningReport, calibrateOverallV24 } from "./playerRatingCalibrationV24.js";
import { buildRatingWarningsV241, calibrateOverallV241 } from "./playerRatingCalibrationV241.js";

export const PLAYER_RATING_MIN = 25;
export const PLAYER_RATING_MAX = 99;
export const RATING_FORMULA_VERSION_V2_0 = "ratings-v2.0.0";
export const RATING_FORMULA_VERSION_V2_1 = "ratings-v2.1.0";
export const RATING_FORMULA_VERSION_V2_2 = "ratings-v2.2.0";
export const RATING_FORMULA_VERSION_V2_3 = "ratings-v2.3.0";
export const RATING_FORMULA_VERSION_V2_4 = "ratings-v2.4.0";
export const RATING_FORMULA_VERSION = "ratings-v2.4.1";
export const RATINGS_SOURCE_V2 = "balldontlie-goat";
export const V2_RATING_KEYS = Object.freeze([
  "overall", "rimScoring", "midRange", "threePoint", "freeThrow", "playmaking",
  "ballHandling", "turnoverControl", "perimeterDefense", "interiorDefense", "steal",
  "block", "offensiveRebounding", "defensiveRebounding", "athleticism", "stamina", "consistency",
]);
const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const clamp = (value, min = PLAYER_RATING_MIN, max = PLAYER_RATING_MAX) => Math.max(min, Math.min(max, value));
const score = (value, low, high) => clamp(Math.round(PLAYER_RATING_MIN + clamp((value - low) / (high - low), 0, 1) * (PLAYER_RATING_MAX - PLAYER_RATING_MIN)));
const blend = (baseline, observed, confidence) => clamp(Math.round(baseline + (observed - baseline) * confidence));
const baselineFor = (position) => ({ PG: 64, SG: 63, SF: 63, PF: 62, C: 62 }[position] || 63);
const position = (value) => POSITIONS.includes(String(value || "").toUpperCase()) ? String(value).toUpperCase() : "SF";

export function calculateRatingsConfidence(input) {
  const stats = normalizeSeasonStatRecord(input);
  const games = clamp(stats.gamesPlayed / 55, 0, 1);
  const minutes = clamp(stats.minutesPerGame / 30, 0, 1);
  const starts = stats.gamesPlayed ? clamp(stats.gamesStarted / stats.gamesPlayed, 0, 1) : 0;
  return Math.round((games * 0.5 + minutes * 0.35 + starts * 0.15) * 1000) / 1000;
}

const OVERALL_WEIGHTS = Object.freeze({
  PG: { playmaking: .22, ballHandling: .15, turnoverControl: .12, threePoint: .15, rimScoring: .08, perimeterDefense: .12, athleticism: .06, stamina: .05, consistency: .05 },
  SG: { threePoint: .19, rimScoring: .15, midRange: .1, playmaking: .12, ballHandling: .1, perimeterDefense: .14, athleticism: .08, stamina: .06, consistency: .06 },
  SF: { rimScoring: .13, threePoint: .14, midRange: .08, playmaking: .09, perimeterDefense: .14, interiorDefense: .08, defensiveRebounding: .1, athleticism: .1, stamina: .07, consistency: .07 },
  PF: { rimScoring: .16, threePoint: .08, interiorDefense: .16, defensiveRebounding: .15, offensiveRebounding: .09, block: .08, playmaking: .06, athleticism: .09, stamina: .07, consistency: .06 },
  C: { rimScoring: .18, interiorDefense: .18, defensiveRebounding: .17, offensiveRebounding: .1, block: .11, playmaking: .07, turnoverControl: .04, athleticism: .06, stamina: .04, consistency: .05 },
});
export const RATINGS_V2_OVERALL_WEIGHTS = OVERALL_WEIGHTS;

export function calculatePositionOverall(ratings, primaryPosition = "SF") {
  const weights = OVERALL_WEIGHTS[position(primaryPosition)];
  return clamp(Math.round(Object.entries(weights).reduce((total, [key, weight]) => total + ratings[key] * weight, 0)));
}

const valueAt = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);
const metric = (key, { invert = false, weight = 1, label = key } = {}) => ({ key, invert, weight, label });
const ATTRIBUTE_SIGNALS = Object.freeze({
  rimScoring: [metric("rimEfficiency", { weight: 1.3, label: "rim efficiency" }), metric("rimFrequency", { weight: 1.1, label: "rim volume" }), metric("driveEfficiency", { label: "drive efficiency" }), metric("freeThrowAttemptsPerGame", { weight: .7, label: "free-throw pressure" }), metric("trueShootingPercentage", { weight: .5, label: "scoring efficiency" })],
  midRange: [metric("midRangeEfficiency", { weight: 1.4, label: "mid-range efficiency" }), metric("midRangeFrequency", { weight: 1.1, label: "mid-range volume" }), metric("pullUpEfficiency", { label: "pull-up efficiency" }), metric("pullUpFrequency", { weight: .7, label: "self-created volume" })],
  threePoint: [metric("threePointPercentage", { weight: 1.2, label: "three-point efficiency" }), metric("threePointAttemptsPerGame", { weight: 1.4, label: "three-point volume" }), metric("threePointFrequency", { weight: .7, label: "three-point frequency" }), metric("catchAndShootEfficiency", { weight: .7, label: "catch-and-shoot efficiency" }), metric("pullUpEfficiency", { weight: .5, label: "pull-up shooting" })],
  freeThrow: [metric("freeThrowPercentage", { weight: 1.6, label: "free-throw efficiency" }), metric("freeThrowAttemptsPerGame", { weight: .4, label: "free-throw sample" })],
  playmaking: [metric("assistPercentage", { weight: 1.3, label: "assist creation" }), metric("assistsPerGame", { weight: 1.1, label: "assist volume" }), metric("passingMetrics.potentialAssists", { weight: .8, label: "potential assists" }), metric("passingMetrics.passEfficiency", { weight: .7, label: "passing efficiency" }), metric("turnoverPercentage", { invert: true, weight: .4, label: "turnover discipline" })],
  ballHandling: [metric("usageRate", { weight: .9, label: "on-ball responsibility" }), metric("driveFrequency", { weight: .9, label: "drive creation" }), metric("pullUpFrequency", { weight: .7, label: "pull-up creation" }), metric("trackingMetrics.touches", { weight: .6, label: "touch volume" }), metric("turnoverPercentage", { invert: true, weight: .5, label: "ball security" })],
  turnoverControl: [metric("turnoverPercentage", { invert: true, weight: 1.4, label: "turnover rate" }), metric("turnoversPerGame", { invert: true, weight: .5, label: "turnover volume" }), metric("passingMetrics.assistToTurnover", { weight: 1.1, label: "assist-to-turnover context" }), metric("usageRate", { weight: .35, label: "handling responsibility" })],
  perimeterDefense: [metric("defensiveDistanceMetrics.perimeterOpponentEfficiency", { invert: true, weight: 1.4, label: "opponent perimeter efficiency" }), metric("hustleMetrics.deflections", { weight: 1.1, label: "deflections" }), metric("hustleMetrics.contestedThreePointShots", { weight: .8, label: "perimeter contests" }), metric("stealsPerGame", { weight: .45, label: "steal activity" })],
  interiorDefense: [metric("defensiveDistanceMetrics.rimOpponentEfficiency", { invert: true, weight: 1.3, label: "opponent rim efficiency" }), metric("trackingMetrics.rimContests", { weight: 1.1, label: "rim contests" }), metric("blocksPerGame", { weight: .55, label: "block activity" }), metric("defensiveReboundPercentage", { weight: .55, label: "possession finishing" })],
  steal: [metric("stealsPerGame", { weight: 1.4, label: "steal rate" }), metric("hustleMetrics.deflections", { weight: .9, label: "deflections" }), metric("hustleMetrics.looseBallsRecovered", { weight: .5, label: "loose-ball activity" })],
  block: [metric("blocksPerGame", { weight: 1.5, label: "block rate" }), metric("trackingMetrics.rimContests", { weight: .9, label: "rim contests" }), metric("defensiveDistanceMetrics.rimOpponentEfficiency", { invert: true, weight: .6, label: "rim deterrence" })],
  offensiveRebounding: [metric("offensiveReboundPercentage", { weight: 1.5, label: "offensive rebound rate" }), metric("offensiveReboundsPerGame", { weight: .9, label: "offensive rebound volume" }), metric("trackingMetrics.contestedReboundPercentage", { weight: .6, label: "contested rebounds" })],
  defensiveRebounding: [metric("defensiveReboundPercentage", { weight: 1.5, label: "defensive rebound rate" }), metric("defensiveReboundsPerGame", { weight: .9, label: "defensive rebound volume" }), metric("trackingMetrics.reboundChanceConversion", { weight: .6, label: "rebound conversion" })],
  athleticism: [metric("driveFrequency", { weight: .7, label: "drive activity" }), metric("hustleMetrics.activityRate", { weight: 1.1, label: "hustle activity" }), metric("trackingMetrics.contestedReboundPercentage", { weight: .6, label: "contested activity" }), metric("trackingMetrics.transitionFrequency", { weight: .8, label: "transition activity" })],
  stamina: [metric("minutesPerGame", { weight: 1.2, label: "minutes workload" }), metric("gamesPlayed", { weight: .9, label: "availability" }), metric("totalMinutes", { weight: 1.1, label: "season workload" })],
  consistency: [metric("gameLogVariance.production", { invert: true, weight: 1.2, label: "production stability" }), metric("gameLogVariance.shooting", { invert: true, weight: .8, label: "shooting stability" }), metric("gamesPlayed", { weight: .6, label: "availability sample" }), metric("minutesPerGame", { weight: .4, label: "role stability" })],
});

const selectors = Object.fromEntries([...new Set(Object.values(ATTRIBUTE_SIGNALS).flat().map((signal) => signal.key))].map((key) => [key, (row) => valueAt(row.stats, key)]));
const median = (values, fallback = 67) => values.length ? values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)] : fallback;

function observedAttribute(attribute, row, normalizer, formulaVersion) {
  const ranked = ATTRIBUTE_SIGNALS[attribute].map((signal) => {
    const rank = normalizer.rank(signal.key, valueAt(row.stats, signal.key), row.player.eligiblePositions || [row.player.primaryPosition]);
    return rank === null ? null : { ...signal, rank: signal.invert ? 1 - rank : rank };
  }).filter(Boolean);
  if (!ranked.length) return { rating: 62, coverage: 0, signals: ["advanced signal unavailable"] };
  const percentile = ranked.reduce((sum, signal) => sum + signal.rank * signal.weight, 0) / ranked.reduce((sum, signal) => sum + signal.weight, 0);
  const strongest = ranked.toSorted((a, b) => b.rank - a.rank).slice(0, 3).filter((signal) => signal.rank >= .67).map((signal) => `${signal.rank >= .9 ? "elite" : "strong"} ${signal.label}`);
  const mapRating = formulaVersion === RATING_FORMULA_VERSION_V2_0 ? percentileToRating : percentileToRatingElite;
  return { rating: mapRating(percentile), percentile, coverage: ranked.length / ATTRIBUTE_SIGNALS[attribute].length, signals: strongest.length ? strongest : ["conservative population context"] };
}

function blendedOverall(ratings, player) {
  const positions = [...new Set([player.primaryPosition, ...(player.eligiblePositions || [])].map(position))];
  const values = positions.map((item) => calculatePositionOverall(ratings, item));
  return clampRating(values[0] * .65 + Math.max(...values) * .35);
}

const averageRatings = (ratings, keys) => keys.reduce((sum, key) => sum + ratings[key], 0) / keys.length;

function calibratedOverall(ratings, player, confidence, formulaVersion) {
  const baseOverall = blendedOverall(ratings, player);
  if (formulaVersion === RATING_FORMULA_VERSION_V2_0) return { overall: baseOverall, baseOverall, eliteBoost: 0, twoWayBonus: 0, weakLinkPenalty: 0, breadth: 0 };
  const weights = OVERALL_WEIGHTS[position(player.primaryPosition)];
  const weightedBreadth = Object.entries(weights).reduce((sum, [key, weight]) => sum + (ratings[key] >= 85 ? weight : ratings[key] >= 80 ? weight * .35 : 0), 0);
  const breadth = clamp((weightedBreadth - .18) / .62, 0, 1);
  const offense = averageRatings(ratings, ["rimScoring", "midRange", "threePoint", "playmaking", "ballHandling"]);
  const defense = averageRatings(ratings, ["perimeterDefense", "interiorDefense", "steal", "block", "defensiveRebounding"]);
  const twoWay = clamp((Math.min(offense, defense) - 79) / 10, 0, 1);
  const confidenceFactor = confidence.status === "verified" ? clamp((confidence.score - .58) / .3, .55, 1) : confidence.status === "provisional" ? .22 : .05;
  const excess = Math.max(0, baseOverall - 82);
  const eliteBoost = .13 * excess ** 2 * (.62 + .38 * breadth) * confidenceFactor;
  const twoWayBonus = 1.2 * twoWay * confidenceFactor * clamp(excess / 5, 0, 1);
  const weakLinkPenalty = Object.entries(weights).some(([key, weight]) => weight >= .1 && ratings[key] < 48) ? Math.min(2, (48 - Math.min(...Object.entries(weights).filter(([, weight]) => weight >= .1).map(([key]) => ratings[key]))) / 5) : 0;
  return { overall: clampRating(baseOverall + eliteBoost + twoWayBonus - weakLinkPenalty), baseOverall, eliteBoost: Math.round(eliteBoost * 100) / 100, twoWayBonus: Math.round(twoWayBonus * 100) / 100, weakLinkPenalty: Math.round(weakLinkPenalty * 100) / 100, breadth: Math.round(breadth * 1000) / 1000 };
}

export function generateRatingsV2Population({ players = [], seasonStats = [], historicalSeasonStats = {}, generatedAt = new Date().toISOString(), ratingsSource = RATINGS_SOURCE_V2, formulaVersion = RATING_FORMULA_VERSION } = {}) {
  if (![RATING_FORMULA_VERSION_V2_0, RATING_FORMULA_VERSION_V2_1, RATING_FORMULA_VERSION_V2_2, RATING_FORMULA_VERSION_V2_3, RATING_FORMULA_VERSION_V2_4, RATING_FORMULA_VERSION].includes(formulaVersion)) throw new Error(`Unsupported Ratings V2 formula version: ${formulaVersion}.`);
  const historicalEntries = [RATING_FORMULA_VERSION_V2_4, RATING_FORMULA_VERSION].includes(formulaVersion) ? [historicalSeasonStats.previousSeason, historicalSeasonStats.twoSeasonsAgo].filter((rows) => Array.isArray(rows) && rows.length).map((rows) => ({ rows, generated: generateRatingsV2Population({ players, seasonStats: rows, generatedAt, ratingsSource, formulaVersion: RATING_FORMULA_VERSION_V2_3 }) })) : [];
  const historicalById = new Map();
  for (const entry of historicalEntries) { const statsByExternalId = new Map(entry.rows.map((stats) => [String(stats.externalPlayerId), normalizeSeasonStatRecord(stats)])); for (const result of entry.generated.results) { const values = historicalById.get(String(result.playerId)) || []; values.push({ ratings: result.ratings, stats: statsByExternalId.get(String(result.externalPlayerId)), confidence: result.ratingsConfidence }); historicalById.set(String(result.playerId), values); } }
  const statsById = new Map(seasonStats.map((stats) => [String(stats.externalPlayerId), normalizeSeasonStatRecord(stats)]));
  const rows = players.map((player) => ({ player, stats: statsById.get(String(player.externalPlayerId ?? player.source?.externalId ?? player.identity?.externalIds?.[0]?.value)) })).filter((row) => row.stats);
  const normalizer = buildPopulationNormalizer(rows, selectors);
  const observed = new Map(rows.map((row) => [row.player.id ?? row.player.identity?.id, Object.fromEntries(Object.keys(ATTRIBUTE_SIGNALS).map((attribute) => [attribute, observedAttribute(attribute, row, normalizer, formulaVersion)]))]));
  const baselines = {};
  for (const positionName of POSITIONS) {
    const scoped = rows.filter((row) => (row.player.eligiblePositions || [row.player.primaryPosition]).includes(positionName));
    baselines[positionName] = Object.fromEntries(Object.keys(ATTRIBUTE_SIGNALS).map((attribute) => [attribute, median(scoped.map((row) => observed.get(row.player.id ?? row.player.identity?.id)[attribute].rating))]));
  }
  const results = rows.map((row) => {
    const identity = row.player.id ?? row.player.identity?.id;
    const confidence = calculateRatingsConfidenceV2(row.stats);
    const trust = confidence.status === "verified" ? .4 + confidence.score * .6 : confidence.status === "provisional" ? .18 + confidence.score * .5 : .08 + confidence.score * .25;
    const contexts = row.player.eligiblePositions?.length ? row.player.eligiblePositions : [row.player.primaryPosition || row.stats.primaryPosition];
    const details = {};
    const rawDetails = {};
    const explanations = {};
    let coverageTotal = 0;
    for (const attribute of Object.keys(ATTRIBUTE_SIGNALS)) {
      const item = observed.get(identity)[attribute];
      rawDetails[attribute] = item.rating;
      const positionalBaseline = median(contexts.map((itemPosition) => baselines[position(itemPosition)]?.[attribute]).filter(Number.isFinite));
      details[attribute] = clampRating(positionalBaseline + (item.rating - positionalBaseline) * trust);
      coverageTotal += item.coverage;
      explanations[attribute] = { rating: details[attribute], signals: [...item.signals, `${confidence.level} sample confidence`] };
    }
    const rawOverall = blendedOverall(rawDetails, row.player);
    const legacyCalibration = calibratedOverall(details, row.player, confidence, formulaVersion);
    const calibration = formulaVersion === RATING_FORMULA_VERSION ? calibrateOverallV241({ ratings: details, stats: row.stats, confidence, historicalSeasons: historicalById.get(String(identity)) || [] }) : formulaVersion === RATING_FORMULA_VERSION_V2_4 ? calibrateOverallV24({ ratings: details, stats: row.stats, confidence, historicalSeasons: historicalById.get(String(identity)) || [] }) : formulaVersion === RATING_FORMULA_VERSION_V2_3 ? calibrateOverallV23({ ratings: details, stats: row.stats, confidence }) : formulaVersion === RATING_FORMULA_VERSION_V2_2 ? calibrateOverallV22({ ratings: details, stats: row.stats, confidence, baseOverall: legacyCalibration.baseOverall }) : legacyCalibration;
    details.overall = calibration.overall;
    const ratings = Object.freeze({ version: RATINGS_VERSION_V2, source: `verified-season-stats:${row.stats.provider}`, ...details });
    return {
      playerId: identity, externalPlayerId: String(row.stats.externalPlayerId), ratingsVersion: RATINGS_VERSION_V2,
      ratingsSource, ratingsSeason: row.stats.season, ratingsGeneratedAt: generatedAt, ratingFormulaVersion: formulaVersion,
      ratingsStatus: confidence.status, ratingsConfidence: confidence,
      ratingsCoverage: Math.round(coverageTotal / Object.keys(ATTRIBUTE_SIGNALS).length * 100) / 100,
      overall: ratings.overall, ratings, explanations, normalizedInput: row.stats,
      calibrationProfile: [RATING_FORMULA_VERSION_V2_2, RATING_FORMULA_VERSION_V2_3, RATING_FORMULA_VERSION_V2_4, RATING_FORMULA_VERSION].includes(formulaVersion) ? calibration : null,
      calibrationDiagnostics: { rawOverall, confidenceAdjustedOverall: legacyCalibration.baseOverall, confidenceRegression: rawOverall - legacyCalibration.baseOverall, eliteBoost: legacyCalibration.eliteBoost, twoWayBonus: legacyCalibration.twoWayBonus, weakLinkPenalty: legacyCalibration.weakLinkPenalty, breadth: legacyCalibration.breadth, rawAttributes: rawDetails, missingAttributes: Object.entries(observed.get(identity)).filter(([, item]) => item.coverage === 0).map(([attribute]) => attribute) },
    };
  });
  if (![RATING_FORMULA_VERSION_V2_2, RATING_FORMULA_VERSION_V2_3, RATING_FORMULA_VERSION_V2_4, RATING_FORMULA_VERSION].includes(formulaVersion)) return { results: results.map((item) => Object.freeze(item)), normalizationMetadata: normalizer.metadata, positionalBaselines: baselines };
  const ranked = results.toSorted((a, b) => b.overall - a.overall || String(a.playerId).localeCompare(String(b.playerId)));
  const positionRanks = new Map();
  for (const item of ranked) { const key = position(item.normalizedInput.primaryPosition); positionRanks.set(key, (positionRanks.get(key) || 0) + 1); item.populationRank = ranked.indexOf(item) + 1; item.positionRank = positionRanks.get(key); }
  const roleRanks = new Map();
  for (const item of ranked) { const key = item.calibrationProfile?.role || "UNCLASSIFIED"; roleRanks.set(key, (roleRanks.get(key) || 0) + 1); item.roleRank = roleRanks.get(key); item.populationPercentile = Math.round((1 - (item.populationRank - 1) / Math.max(1, ranked.length - 1)) * 1000) / 1000; }
  for (const item of ranked) { item.outliers = formulaVersion === RATING_FORMULA_VERSION ? buildRatingWarningsV241(item, ranked) : formulaVersion === RATING_FORMULA_VERSION_V2_4 ? buildRatingWarningsV24(item, ranked) : formulaVersion === RATING_FORMULA_VERSION_V2_3 ? buildRatingOutliersV23(item, ranked) : buildRatingOutliers(item); Object.freeze(item); }
  const warningReport = formulaVersion === RATING_FORMULA_VERSION_V2_4 ? buildV24WarningReport(ranked) : formulaVersion === RATING_FORMULA_VERSION ? { criticalIssues: [], warnings: ranked.flatMap((item) => item.outliers || []), groups: [], approvalEligible: true } : null;
  const v23Report = formulaVersion === RATING_FORMULA_VERSION_V2_3 ? buildV23RealismReport(ranked) : null;
  const positions = [...new Set(ranked.map((item) => item.normalizedInput.primaryPosition))];
  const positionAverages = Object.fromEntries(positions.map((key) => { const values = ranked.filter((item) => item.normalizedInput.primaryPosition === key); return [key, Math.round(values.reduce((sum, item) => sum + item.overall, 0) / values.length * 100) / 100]; }));
  const realismReport = warningReport ? { realismScore: Math.max(0, Math.round((100 - warningReport.criticalIssues.length * 4 - warningReport.warnings.length * .08) * 10) / 10), ...warningReport, positionAverages } : v23Report;
  return { results, normalizationMetadata: normalizer.metadata, positionalBaselines: baselines, realismReport };
}

export function generatePlayerRatings({ player = {}, seasonStats }) {
  const stats = normalizeSeasonStatRecord(seasonStats);
  const primary = position(player.primaryPosition || player.position || stats.position);
  // Confidence is intentionally squared: small samples regress strongly while
  // established starter workloads approach their observed box-score signal.
  const confidence = calculateRatingsConfidence(stats);
  const trust = .18 + .82 * confidence ** 2;
  const base = baselineFor(primary);
  const assistTurnover = stats.assistsPerGame / Math.max(.75, stats.turnoversPerGame);
  const scoringEfficiency = stats.fieldGoalPercentage * .55 + stats.freeThrowPercentage * .15 + stats.threePointPercentage * .3;
  const observed = {
    rimScoring: score(stats.pointsPerGame * .62 + stats.freeThrowAttemptsPerGame * 1.2 + stats.fieldGoalPercentage * 20, 8, 33),
    midRange: score(stats.pointsPerGame * .45 + scoringEfficiency * 20 - stats.threePointAttemptsPerGame * .35, 6, 22),
    threePoint: score(stats.threePointPercentage * 65 + Math.min(10, stats.threePointAttemptsPerGame) * 3.2, 20, 54),
    freeThrow: score(stats.freeThrowPercentage, .55, .92),
    playmaking: score(stats.assistsPerGame * 7 + assistTurnover * 4, 5, 75),
    ballHandling: score(stats.assistsPerGame * 5 + stats.pointsPerGame * .7 - stats.turnoversPerGame * 3, 5, 55),
    turnoverControl: score(assistTurnover + Math.max(0, 3.5 - stats.turnoversPerGame) * .7, .5, 6.5),
    perimeterDefense: score(stats.stealsPerGame * 16 + stats.minutesPerGame * .35 + (["PG", "SG", "SF"].includes(primary) ? 8 : 2), 7, 45),
    interiorDefense: score(stats.blocksPerGame * 18 + stats.defensiveReboundsPerGame * 2.2 + (["PF", "C"].includes(primary) ? 9 : 0), 5, 48),
    steal: score(stats.stealsPerGame, .15, 2.2),
    block: score(stats.blocksPerGame, .05, 2.8),
    offensiveRebounding: score(stats.offensiveReboundsPerGame, .15, 4.5),
    defensiveRebounding: score(stats.defensiveReboundsPerGame, .8, 10.5),
    athleticism: score(stats.minutesPerGame + stats.offensiveReboundsPerGame * 2 + stats.freeThrowAttemptsPerGame, 10, 46),
    stamina: score(stats.minutesPerGame, 8, 38),
    consistency: score(confidence, .1, .95),
  };
  const ratings = Object.fromEntries(Object.entries(observed).map(([key, value]) => [key, blend(base, value, trust)]));
  ratings.overall = calculatePositionOverall(ratings, primary);
  return Object.freeze({ version: RATINGS_VERSION_V2, source: `verified-season-stats:${stats.provider}`, season: stats.season, ...ratings });
}

export function isValidRatingsV2(value) {
  return Boolean(value) && value.version === RATINGS_VERSION_V2 && typeof value.source === "string" && value.source.startsWith("verified-season-stats:") &&
    V2_RATING_KEYS.every((key) => Number.isInteger(value[key]) && value[key] >= PLAYER_RATING_MIN && value[key] <= PLAYER_RATING_MAX);
}

export const hasVerifiedRatingsV2 = (player) => player?.ratingsVersion === RATINGS_VERSION_V2 && isValidRatingsV2(player.ratings) && player.overall === player.ratings.overall;
export const getPlayerRatingsVersion = (player) => hasVerifiedRatingsV2(player) ? RATINGS_VERSION_V2 : RATINGS_VERSION_V1;
export const getPlayerOverall = (player) => Number.isInteger(player?.overall) ? clamp(player.overall) : Number.isInteger(player?.ratings?.overall) ? clamp(player.ratings.overall) : 75;

export function normalizeCanonicalPlayerRatings(player = {}) {
  if (hasVerifiedRatingsV2(player)) return { ratingsVersion: RATINGS_VERSION_V2, overall: player.ratings.overall, ratings: { ...player.ratings } };
  const overall = getPlayerOverall(player);
  const legacy = player.ratings && typeof player.ratings === "object" ? { ...player.ratings } : { overall, source: "legacy-unavailable" };
  return { ratingsVersion: RATINGS_VERSION_V1, overall, ratings: { ...legacy, overall, version: RATINGS_VERSION_V1 } };
}

export function getPlayerDetailedRatings(player = {}) {
  if (hasVerifiedRatingsV2(player)) return { ...player.ratings };
  const overall = getPlayerOverall(player);
  const legacy = player.ratings && typeof player.ratings === "object" ? player.ratings : {};
  return Object.fromEntries(V2_RATING_KEYS.map((key) => [key, key === "overall" ? overall : Number.isInteger(legacy[key]) ? clamp(legacy[key]) : overall]));
}
