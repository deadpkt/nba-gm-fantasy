import { buildV23Domains } from "./playerRatingCalibrationV23.js";
import { calibrateOverallV24 } from "./playerRatingCalibrationV24.js";

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const round = (value, precision = 2) => Math.round(value * 10 ** precision) / 10 ** precision;
const tierFor = (overall) => overall >= 96 ? "TIER_S" : overall >= 92 ? "TIER_A_PLUS" : overall >= 88 ? "TIER_A" : overall >= 84 ? "TIER_B_PLUS" : overall >= 80 ? "TIER_B" : overall >= 76 ? "TIER_C_PLUS" : overall >= 72 ? "TIER_C" : overall >= 68 ? "TIER_D" : "TIER_E";
const weightedAvailable = (components) => { const available = components.filter((item) => item.available && Number.isFinite(item.value)); const weight = available.reduce((sum, item) => sum + item.weight, 0); return weight ? available.reduce((sum, item) => sum + item.value * item.weight, 0) / weight : null; };

export function buildRobustDomainsV241(ratings, stats) {
  const legacy = buildV23Domains(ratings).domains;
  const scoring = weightedAvailable([
    { value: ratings.rimScoring, weight: .25, available: stats.rimEfficiency != null || stats.fieldGoalPercentage != null },
    { value: ratings.midRange, weight: .14, available: stats.midRangeEfficiency != null || stats.midRangeFrequency != null },
    { value: ratings.threePoint, weight: .38, available: stats.threePointPercentage != null && stats.threePointAttemptsPerGame != null },
    { value: ratings.freeThrow, weight: .13, available: stats.freeThrowPercentage != null },
    { value: ratings.ballHandling, weight: .1, available: stats.trackingMetrics?.touches != null || stats.assistsPerGame != null },
  ]);
  const responsibility = clamp(((stats.usageRate ?? .18) - .12) / .24 * .45 + ((stats.assistsPerGame ?? 0) / 9) * .25 + ((stats.trackingMetrics?.touches ?? 25) - 20) / 70 * .2 + ((stats.driveFrequency ?? 0) / 15) * .1);
  const turnoverBurden = clamp(((stats.turnoversPerGame ?? 0) - 1) / 4);
  const responsibilityAdjustedTurnover = Math.max(25, Math.min(99, ratings.turnoverControl + responsibility * 10 - turnoverBurden * 4));
  const creation = weightedAvailable([
    { value: ratings.playmaking, weight: .43, available: stats.assistsPerGame != null || stats.passingMetrics?.potentialAssists != null },
    { value: ratings.ballHandling, weight: .37, available: stats.trackingMetrics?.touches != null || stats.driveFrequency != null || stats.assistsPerGame != null },
    { value: responsibilityAdjustedTurnover, weight: .2, available: stats.turnoversPerGame != null },
  ]);
  return { ...legacy, scoring: round(scoring ?? legacy.scoring), creation: round(creation ?? legacy.creation), responsibilityAdjustedTurnover: round(responsibilityAdjustedTurnover), responsibility: round(responsibility, 3) };
}

export function sustainedEliteEvidenceV241({ seasons, robustDomains, shootingGravity, trend, confidence }) {
  const verifiedSeasons = seasons.filter((season) => (season.confidence?.status || confidence.status) === "verified").length;
  const persistence = clamp((Math.max(robustDomains.scoring, robustDomains.creation) - 78) / 14);
  const breadth = clamp(([robustDomains.scoring, robustDomains.creation, robustDomains.perimeterDefense, robustDomains.interiorDefense, robustDomains.rebounding].filter((value) => value >= 80).length - 1) / 3);
  const continuity = clamp((seasons.filter((season) => (season.stats?.minutesPerGame || 0) >= 24).length) / 3);
  const gravitySupport = clamp((shootingGravity - .55) / .35);
  const trendFactor = trend === "SHARP_DECLINE" ? .35 : trend === "DECLINING" ? .68 : 1;
  return round(clamp((verifiedSeasons / 3) * .28 + persistence * .25 + breadth * .14 + continuity * .18 + gravitySupport * .15) * trendFactor, 3);
}

export function classifyShootingArchetypeV241({ gravity, domains, workload, confidence, seasonCount, sustainedEliteEvidence }) {
  const sustainedHybrid = seasonCount >= 3 && gravity >= .74 && domains.scoring >= 84 && domains.creation >= 76 && sustainedEliteEvidence >= .34;
  if (confidence.status === "verified" && seasonCount >= 2 && workload >= .45 && (sustainedHybrid || (gravity >= .7 && domains.scoring >= 80 && domains.creation >= 70 && sustainedEliteEvidence >= .48))) return "OFF_BALL_SUPERSTAR";
  if (confidence.status === "verified" && gravity >= .68 && domains.scoring >= 76 && workload >= .45) return "ELITE_SPACING_STAR";
  if (gravity >= .62 && workload >= .28) return "ROTATION_SPACER";
  if (gravity >= .55) return "SHOOTING_SPECIALIST";
  return null;
}

const roleCompatibility = (archetype, fallback) => archetype === "OFF_BALL_SUPERSTAR" ? "SECONDARY_STAR" : archetype === "ELITE_SPACING_STAR" ? "HIGH_LEVEL_STARTER" : fallback;
export function calibrateOverallV241({ ratings, stats, confidence, historicalSeasons = [] }) {
  const v24 = calibrateOverallV24({ ratings, stats, confidence, historicalSeasons });
  const seasons = [{ stats, ratings, confidence }, ...historicalSeasons].slice(0, 3);
  const robustDomains = buildRobustDomainsV241(v24.sustainedRatings ? { ...ratings, ...v24.sustainedRatings } : ratings, stats);
  const sustainedEliteEvidence = sustainedEliteEvidenceV241({ seasons, robustDomains, shootingGravity: v24.shootingGravity, trend: v24.trend, confidence });
  const shootingArchetype = classifyShootingArchetypeV241({ gravity: v24.shootingGravity, domains: robustDomains, workload: v24.signals.workload, confidence, seasonCount: seasons.length, sustainedEliteEvidence });
  const offensiveDomainLift = Math.max(0, robustDomains.scoring - v24.sustainedDomains.scoring) * .12 + Math.max(0, robustDomains.creation - v24.sustainedDomains.creation) * .1;
  const eliteLift = shootingArchetype === "OFF_BALL_SUPERSTAR" ? Math.min(3, sustainedEliteEvidence * 2.8 + Math.max(0, v24.shootingGravity - .7) * 5) : sustainedEliteEvidence >= .72 && v24.starQualified ? Math.min(1.5, sustainedEliteEvidence * 1.5) : 0;
  let overall = Math.round(v24.overall + Math.min(2.5, offensiveDomainLift) + eliteLift);
  if (shootingArchetype === "OFF_BALL_SUPERSTAR") overall = Math.max(overall, 90);
  if (confidence.status === "provisional") overall = Math.min(overall, 83);
  if (confidence.status === "insufficient_data") overall = Math.min(overall, 75);
  if (v24.trend === "SHARP_DECLINE") overall = Math.min(overall, v24.overall + 1);
  overall = Math.max(25, Math.min(99, overall));
  const internalRole = shootingArchetype || v24.internalRole; const role = roleCompatibility(shootingArchetype, v24.role);
  return { ...v24, overall, finalSeasonOverall: overall, tier: tierFor(overall), role, internalRole, shootingArchetype, robustDomains, sustainedEliteEvidence, offensiveDomainLift: round(offensiveDomainLift), eliteLift: round(eliteLift), responsibilityAdjustedTurnover: robustDomains.responsibilityAdjustedTurnover, explanation: { strengths: [...new Set([...v24.explanation.strengths, ...(sustainedEliteEvidence >= .48 ? ["verified sustained elite evidence"] : []), ...(shootingArchetype ? [`${shootingArchetype.toLowerCase().replaceAll("_", " ")} profile`] : [])])], limiters: v24.explanation.limiters } };
}

export const V241_WARNING_DEFINITIONS = Object.freeze({
  ELITE_SKILL_PROFILE_UNDERRATED: ["WARNING", "Elite multi-domain profile rated too low", "Multiple independent verified impact domains remain below the expected Overall range.", "Robust domain aggregation", "CORRELATED_WEAK_ATTRIBUTE_DRAG"],
  OFF_BALL_SUPERSTAR_MISCLASSIFIED: ["WARNING", "Sustained off-ball superstar classified too low", "Verified multi-season gravity, creation, workload, and persistence support the off-ball superstar path.", "Off-ball role model", "ROLE_CLASSIFICATION_MISMATCH"],
  REVIEW_ONLY_VALID_LIMITATION: ["INFO", "Elite specialty with valid overall limitation", "An elite single domain is preserved, while limited breadth, workload, or offense correctly limits Overall.", "No formula change", "LEGITIMATE_WARNING_NO_FORMULA_CHANGE"],
});
const warning = (player, code, values) => { const [severity, title, explanation, suggestedArea, rootCause] = V241_WARNING_DEFINITIONS[code]; return { playerId: player.playerId, name: player.name, code, reason: code, severity, title, explanation, suggestedArea, rootCause, relevantValues: values }; };
export function buildRatingWarningsV241(player) {
  const profile = player.calibrationProfile || {}; const domains = profile.robustDomains || profile.sustainedDomains || {}; const warnings = [];
  const eliteDomains = [domains.scoring, domains.creation, domains.perimeterDefense, domains.interiorDefense, domains.rebounding].filter((value) => value >= 88).length;
  const eliteOffense = domains.scoring >= 86 && domains.creation >= 80;
  if ((eliteDomains >= 3 || eliteOffense) && player.overall < 84 && player.ratingsStatus === "verified") warnings.push(warning(player, "ELITE_SKILL_PROFILE_UNDERRATED", { eliteDomains, scoring: domains.scoring, creation: domains.creation, overall: player.overall }));
  if (profile.sustainedEliteEvidence >= .48 && profile.shootingGravity >= .7 && profile.internalRole !== "OFF_BALL_SUPERSTAR" && player.ratingsStatus === "verified" && profile.seasonCount >= 2) warnings.push(warning(player, "OFF_BALL_SUPERSTAR_MISCLASSIFIED", { evidence: profile.sustainedEliteEvidence, gravity: profile.shootingGravity, role: profile.internalRole }));
  return warnings;
}

export function buildWarningResolutionV241(previousPlayers, nextPlayers) {
  const next = new Map(nextPlayers.map((player) => [String(player.playerId), player]));
  const previous = previousPlayers.flatMap((player) => (player.outliers || []).map((item) => ({ playerId: player.playerId, name: player.name, previousOverall: player.overall, code: item.code || item.reason })));
  return previous.map((item) => { const player = next.get(String(item.playerId)); const unresolved = player?.outliers?.some((warningItem) => (warningItem.code || warningItem.reason) === item.code); const rootCause = item.code === "ELITE_SKILL_PROFILE_UNDERRATED" ? "LEGITIMATE_WARNING_NO_FORMULA_CHANGE" : player?.ratingsStatus !== "verified" || (player?.calibrationProfile?.seasonCount || 0) < 2 ? "PARTIAL_HISTORY_UNCERTAINTY" : "ROLE_CLASSIFICATION_MISMATCH"; return { ...item, rootCause, newOverall: player?.overall ?? null, newRole: player?.calibrationProfile?.role ?? null, newArchetype: player?.calibrationProfile?.internalRole ?? null, trend: player?.calibrationProfile?.trend ?? null, shootingGravity: player?.calibrationProfile?.shootingGravity ?? null, evidence: player?.calibrationProfile?.sustainedEliteEvidence ?? null, status: unresolved ? "unresolved" : "resolved" }; });
}
