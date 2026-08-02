import { normalizeSeasonStatRecord } from "./seasonStats.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const round = (value, precision = 3) => Math.round(value * 10 ** precision) / 10 ** precision;
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export const MULTI_SEASON_SCHEMA_VERSION = "ratings-multi-season-v1";
export const BASE_SEASON_WEIGHTS = Object.freeze([.6, .27, .13]);
export const PERSISTENCE_GROUPS = Object.freeze({
  highlyPersistent: ["freeThrow", "threePoint", "ballHandling", "playmaking"],
  moderatelyPersistent: ["rimScoring", "midRange", "perimeterDefense", "interiorDefense", "steal", "block", "offensiveRebounding", "defensiveRebounding"],
  workloadSensitive: ["athleticism", "stamina", "consistency"],
});

const sampleEvidence = (stats) => clamp((stats.gamesPlayed / 65) * .45 + ((stats.totalMinutes ?? stats.gamesPlayed * stats.minutesPerGame) / 2100) * .35 + (stats.minutesPerGame / 32) * .2);

export function adjustedSeasonWeights(seasons = []) {
  if (!seasons.length) return [];
  const currentEvidence = sampleEvidence(seasons[0].stats);
  const template = currentEvidence >= .78 ? [.6, .27, .13] : currentEvidence >= .42 ? [.45, .36, .19] : [.25, .5, .25];
  const available = seasons.map((season, index) => ({ ...season, rawWeight: template[index] || 0 })).filter((season) => season.stats && season.rawWeight > 0);
  const total = available.reduce((sum, season) => sum + season.rawWeight, 0);
  return available.map((season) => ({ ...season, weight: round(season.rawWeight / total), sampleEvidence: round(sampleEvidence(season.stats)) }));
}

const persistenceWeights = (key, seasons) => {
  const base = adjustedSeasonWeights(seasons);
  if (PERSISTENCE_GROUPS.highlyPersistent.includes(key) && base.length > 1) return base.map((item, index) => ({ ...item, weight: index === 0 ? item.weight * .82 : item.weight * 1.28 }));
  if (PERSISTENCE_GROUPS.workloadSensitive.includes(key)) return base.map((item, index) => ({ ...item, weight: index === 0 ? item.weight * 1.2 : item.weight * .72 }));
  return base;
};

export function blendPersistentRating(key, seasons) {
  const weighted = persistenceWeights(key, seasons).filter((item) => Number.isFinite(item.ratings?.[key]));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  return total ? round(weighted.reduce((sum, item) => sum + item.ratings[key] * item.weight, 0) / total, 2) : null;
}

export function buildSustainedRatings(seasons) {
  const keys = Object.values(PERSISTENCE_GROUPS).flat();
  return Object.fromEntries(keys.map((key) => [key, blendPersistentRating(key, seasons)]).filter(([, value]) => Number.isFinite(value)));
}

const seasonImpact = (season) => {
  const stats = season.stats; const ratings = season.ratings || {};
  return round((ratings.overall || 65) * .55 + clamp((stats.pointsPerGame - 6) / 24) * 15 + clamp((stats.assistsPerGame - 1) / 8) * 8 + clamp((stats.minutesPerGame - 12) / 24) * 10 + clamp(((stats.fieldGoalPercentage ?? .42) - .4) / .18) * 7);
};

export function classifyMultiSeasonTrend(seasons) {
  if (!seasons.length) return "SMALL_SAMPLE";
  const evidence = sampleEvidence(seasons[0].stats);
  if (evidence < .28) return seasons.length > 1 ? "RETURNING_FROM_LIMITED_SAMPLE" : "SMALL_SAMPLE";
  if (seasons.length < 2) return evidence >= .65 ? "STABLE" : "SMALL_SAMPLE";
  const impacts = seasons.map(seasonImpact); const recent = impacts[0] - impacts[1]; const prior = seasons.length > 2 ? impacts[1] - impacts[2] : 0;
  if (recent >= 7 && evidence >= .68) return prior >= 1 ? "IMPROVING" : "BREAKOUT";
  if (recent >= 3) return "IMPROVING";
  if (recent <= -8 && prior <= -3) return "SHARP_DECLINE";
  if (recent <= -4 && prior <= 0) return "DECLINING";
  if (average(impacts) >= 88 && Math.abs(recent) < 5) return "SUSTAINED_ELITE";
  return "STABLE";
}

const ratio = (value, low, high) => value === null || value === undefined ? null : clamp((Number(value) - low) / (high - low));
const availableAverage = (values, fallback = 0) => { const finite = values.filter(Number.isFinite); return finite.length ? average(finite) : fallback; };

export function shootingGravityForSeason(stats, ratings = {}) {
  const efficiency = availableAverage([ratio(stats.threePointPercentage, .32, .44), ratio(stats.catchAndShootEfficiency, .32, .47), ratio(stats.pullUpEfficiency, .28, .43)], ratio(ratings.threePoint, 65, 99));
  const volume = availableAverage([ratio(stats.threePointAttemptsPerGame, 2, 11), ratio(stats.threePointFrequency, .2, .68), ratio(stats.catchAndShootFrequency, .05, .35), ratio(stats.pullUpFrequency, .03, .3)], ratio(stats.threePointAttemptsPerGame, 2, 11));
  const selfCreatedThreat = availableAverage([ratio(stats.pullUpEfficiency, .28, .43), ratio(stats.pullUpFrequency, .03, .3), ratio(stats.trackingMetrics?.touches, 25, 85)], .35);
  return round(clamp(efficiency * .45 + volume * .38 + selfCreatedThreat * .17));
}

export function buildShootingGravity(seasons) {
  const weighted = adjustedSeasonWeights(seasons).map((item) => ({ ...item, gravity: shootingGravityForSeason(item.stats, item.ratings) }));
  return round(weighted.reduce((sum, item) => sum + item.gravity * item.weight, 0));
}

export function normalizeMultiSeasonInput(value = {}) {
  const slots = [value.currentSeason, value.previousSeason, value.twoSeasonsAgo];
  const normalized = slots.map((stats) => stats ? normalizeSeasonStatRecord(stats) : null);
  if (!normalized[0]) throw new Error("A normalized current season is required.");
  return Object.freeze({ schemaVersion: MULTI_SEASON_SCHEMA_VERSION, currentSeason: normalized[0], previousSeason: normalized[1], twoSeasonsAgo: normalized[2] });
}
