import { buildShootingGravity, buildSustainedRatings, classifyMultiSeasonTrend } from "./multiSeasonRatings.js";
import { buildV23Domains, calibrateOverallV23 } from "./playerRatingCalibrationV23.js";

const round = (value, precision = 2) => Math.round(value * 10 ** precision) / 10 ** precision;
const ROLE_COMPATIBILITY = Object.freeze({ PRIMARY_OFFENSIVE_ENGINE: "PRIMARY_STAR", OFF_BALL_SUPERSTAR: "SECONDARY_STAR", PRIMARY_CREATOR: "PRIMARY_STAR", SECONDARY_STAR: "SECONDARY_STAR", TWO_WAY_STAR: "SECONDARY_STAR", HIGH_LEVEL_STARTER: "HIGH_LEVEL_STARTER", SPECIALIST: "ROTATION_SPECIALIST", ROTATION_PLAYER: "ROTATION_PLAYER", BENCH_PLAYER: "BENCH_PLAYER", INSUFFICIENT_DATA: "INSUFFICIENT_DATA" });
const roleRange = (role) => ({ PRIMARY_STAR: [89, 99], SECONDARY_STAR: [85, 95], HIGH_LEVEL_STARTER: [82, 90], ROTATION_SPECIALIST: [73, 84], ROTATION_PLAYER: [70, 79], BENCH_PLAYER: [66, 75], INSUFFICIENT_DATA: [60, 75] }[role] || [77, 87]);
const tierFor = (overall) => overall >= 96 ? "TIER_S" : overall >= 92 ? "TIER_A_PLUS" : overall >= 88 ? "TIER_A" : overall >= 84 ? "TIER_B_PLUS" : overall >= 80 ? "TIER_B" : overall >= 76 ? "TIER_C_PLUS" : overall >= 72 ? "TIER_C" : overall >= 68 ? "TIER_D" : "TIER_E";

export function classifyRoleV24({ current, sustained, shootingGravity, trend, confidence }) {
  const signals = current.signals;
  if (confidence.status === "insufficient_data" && trend !== "RETURNING_FROM_LIMITED_SAMPLE") return "INSUFFICIENT_DATA";
  if (shootingGravity >= .7 && sustained.scoring >= 80 && sustained.creation >= 70 && signals.workload >= .45) return "OFF_BALL_SUPERSTAR";
  if (signals.responsibility >= .78 && sustained.creation >= 82 && signals.workload >= .64) return "PRIMARY_OFFENSIVE_ENGINE";
  if (signals.responsibility >= .68 && sustained.creation >= 85) return "PRIMARY_CREATOR";
  if (signals.twoWayImpact >= .58 && signals.workload >= .58) return "TWO_WAY_STAR";
  if (current.role === "SECONDARY_STAR" || (signals.responsibility >= .58 && sustained.scoring >= 80)) return "SECONDARY_STAR";
  if (current.role === "HIGH_LEVEL_STARTER" || signals.workload >= .55) return "HIGH_LEVEL_STARTER";
  if (signals.eliteDomainCount >= 1 || shootingGravity >= .7) return "SPECIALIST";
  if (signals.workload >= .32) return "ROTATION_PLAYER";
  return "BENCH_PLAYER";
}

export function calibrateOverallV24({ ratings, stats, confidence, historicalSeasons = [] }) {
  const current = calibrateOverallV23({ ratings, stats, confidence });
  const seasons = [{ stats, ratings }, ...historicalSeasons.filter((item) => item?.stats && item?.ratings)].slice(0, 3);
  const sustainedRatings = buildSustainedRatings(seasons); const sustained = buildV23Domains({ ...ratings, ...sustainedRatings }).domains;
  const shootingGravity = buildShootingGravity(seasons); const trend = classifyMultiSeasonTrend(seasons);
  const internalRole = classifyRoleV24({ current, sustained, shootingGravity, trend, confidence }); const role = ROLE_COMPATIBILITY[internalRole];
  const historicalOverall = historicalSeasons.filter((item) => Number.isFinite(item?.ratings?.overall)).map((item) => item.ratings.overall);
  const persistentKeys = ["threePoint", "freeThrow", "ballHandling", "playmaking", "rimScoring", "midRange", "perimeterDefense", "interiorDefense", "defensiveRebounding"];
  const persistenceDeltas = persistentKeys.filter((key) => Number.isFinite(sustainedRatings[key]) && Number.isFinite(ratings[key])).map((key) => sustainedRatings[key] - ratings[key]);
  const persistenceAnchor = persistenceDeltas.length ? Math.max(-4, Math.min(4, persistenceDeltas.reduce((sum, value) => sum + value, 0) / persistenceDeltas.length * .18)) : 0;
  const baseOverall = round(current.overall + persistenceAnchor);
  const gravityAdjustment = Math.max(0, shootingGravity - .5) * (internalRole === "OFF_BALL_SUPERSTAR" ? 15 : 8);
  const sustainedSkillAdjustment = ((sustained.scoring - current.signals.domains.scoring) * .12) + ((sustained.creation - current.signals.domains.creation) * .1);
  const trendAdjustment = { SUSTAINED_ELITE: 1.5, BREAKOUT: 1.5, IMPROVING: .75, DECLINING: -1.5, SHARP_DECLINE: -3, SMALL_SAMPLE: -1, RETURNING_FROM_LIMITED_SAMPLE: 0, STABLE: 0 }[trend] || 0;
  const offBallQualification = internalRole === "OFF_BALL_SUPERSTAR" && shootingGravity >= .7 && sustained.scoring >= 80 && confidence.status === "verified";
  let finalSeasonOverall = baseOverall + gravityAdjustment + sustainedSkillAdjustment + trendAdjustment;
  if (offBallQualification && seasons.length > 1) finalSeasonOverall = Math.max(finalSeasonOverall, 88);
  const range = roleRange(role); if (finalSeasonOverall > range[1]) finalSeasonOverall = range[1] + (finalSeasonOverall - range[1]) * .2;
  if (!current.starQualified && !offBallQualification) finalSeasonOverall = Math.min(finalSeasonOverall, 89);
  if (confidence.status === "provisional" && trend !== "SUSTAINED_ELITE") finalSeasonOverall = Math.min(finalSeasonOverall, 83);
  if (trend === "SMALL_SAMPLE" && historicalSeasons.length === 0) finalSeasonOverall = Math.min(finalSeasonOverall, 78);
  const overall = Math.max(25, Math.min(99, Math.round(finalSeasonOverall)));
  const currentFormIndicator = round(current.overall - (historicalOverall.length ? historicalOverall.reduce((sum, value) => sum + value, 0) / historicalOverall.length : current.overall));
  const strengths = [...new Set([...current.explanation.strengths, ...(shootingGravity >= .72 ? ["high derived shooting gravity"] : []), ...(historicalSeasons.length > 0 ? ["multi-season skill evidence"] : [])])];
  const limiters = [...current.explanation.limiters]; if (!historicalSeasons.length) limiters.push("no prior normalized season available"); if (["DECLINING", "SHARP_DECLINE"].includes(trend)) limiters.push("multi-season decline trend");
  return { ...current, overall, tier: tierFor(overall), role, internalRole, roleRange: range, baseOverall, currentFormIndicator, finalSeasonOverall: overall, shootingGravity, shootingGravityLabel: "FULL_COURT_DERIVED", sustainedRatings, sustainedDomains: sustained, trend, seasonCount: seasons.length, offBallQualification, gravityAdjustment: round(gravityAdjustment), sustainedSkillAdjustment: round(sustainedSkillAdjustment), trendAdjustment, explanation: { strengths, limiters } };
}

export const V24_WARNING_DEFINITIONS = Object.freeze({
  SUSTAINED_ELITE_UNDERRATED: ["CRITICAL", "Sustained elite profile rated too low", "Verified multi-season elite impact remains below the expected elite range.", "Multi-season stabilization"],
  ELITE_SKILL_PROFILE_UNDERRATED: ["WARNING", "Elite skill profile below starter range", "Persistent elite skills are not reflected in final season Overall.", "Skill persistence"],
  OFF_BALL_SUPERSTAR_MISCLASSIFIED: ["WARNING", "Off-ball superstar classified too low", "Derived shooting gravity and sustained offensive skill conflict with the assigned role.", "Off-ball role model"],
  ONE_SEASON_ROLE_PLAYER_ABOVE_STAR: ["WARNING", "One-season role player above sustained star", "Current-only evidence ranks above established multi-season impact.", "Population hierarchy"],
  SMALL_SAMPLE_BREAKOUT_OVERREACH: ["CRITICAL", "Small-sample breakout ranked too high", "Limited current evidence exceeds established elite profiles without adequate support.", "Breakout evidence"],
  SHARP_UNEXPLAINED_DROP: ["WARNING", "Sharp year-to-year rating drop", "The new Overall falls sharply without a verified repeated decline.", "Trend stabilization"],
  SHARP_UNEXPLAINED_RISE: ["WARNING", "Sharp year-to-year rating rise", "The new Overall rises sharply without verified breakout evidence.", "Breakout evidence"],
  ROLE_RANK_CONTRADICTION: ["WARNING", "Role and population rank conflict", "The assigned role conflicts with the player's population placement.", "Role classification"],
  POSITION_DISTORTION: ["WARNING", "Position distribution distortion", "This position's average materially exceeds the league distribution.", "Position fairness"],
  CURRENT_MISSING_DATA_OVERPENALIZED: ["WARNING", "Missing current data penalty appears excessive", "Strong prior evidence and limited current coverage produce a suspicious rating drop.", "Missing-data stabilization"],
});

const warning = (player, code, values = {}) => { const [severity, title, explanation, suggestedArea] = V24_WARNING_DEFINITIONS[code]; return { playerId: player.playerId, name: player.name, overall: player.overall, severity, code, reason: code, title, explanation, relevantValues: values, suggestedArea }; };

export function buildRatingWarningsV24(player, population = []) {
  const profile = player.calibrationProfile || {}; const warnings = [];
  if (profile.trend === "SUSTAINED_ELITE" && player.overall < 88) warnings.push(warning(player, "SUSTAINED_ELITE_UNDERRATED", { overall: player.overall, trend: profile.trend }));
  if (Math.max(...Object.values(profile.sustainedDomains || { value: 0 })) >= 90 && player.overall < 82) warnings.push(warning(player, "ELITE_SKILL_PROFILE_UNDERRATED", { strongestDomain: Math.max(...Object.values(profile.sustainedDomains || { value: 0 })) }));
  if (profile.shootingGravity >= .7 && profile.internalRole !== "OFF_BALL_SUPERSTAR" && player.overall < 88) warnings.push(warning(player, "OFF_BALL_SUPERSTAR_MISCLASSIFIED", { shootingGravity: profile.shootingGravity, role: profile.internalRole }));
  if (["SMALL_SAMPLE", "RETURNING_FROM_LIMITED_SAMPLE"].includes(profile.trend) && player.overall >= 88) warnings.push(warning(player, "SMALL_SAMPLE_BREAKOUT_OVERREACH", { trend: profile.trend, seasonCount: profile.seasonCount }));
  if ((player.overallDelta || 0) <= -8 && !["DECLINING", "SHARP_DECLINE"].includes(profile.trend)) warnings.push(warning(player, "SHARP_UNEXPLAINED_DROP", { delta: player.overallDelta, trend: profile.trend }));
  if ((player.overallDelta || 0) >= 8 && !["BREAKOUT", "IMPROVING"].includes(profile.trend)) warnings.push(warning(player, "SHARP_UNEXPLAINED_RISE", { delta: player.overallDelta, trend: profile.trend }));
  if (profile.seasonCount <= 1 && ["ROTATION_PLAYER", "BENCH_PLAYER", "SPECIALIST"].includes(profile.internalRole) && player.overall >= 88) warnings.push(warning(player, "ONE_SEASON_ROLE_PLAYER_ABOVE_STAR", { role: profile.internalRole, overall: player.overall }));
  if (["PRIMARY_OFFENSIVE_ENGINE", "OFF_BALL_SUPERSTAR", "PRIMARY_CREATOR", "TWO_WAY_STAR"].includes(profile.internalRole) && Number(player.populationRank) > 80) warnings.push(warning(player, "ROLE_RANK_CONTRADICTION", { role: profile.internalRole, populationRank: player.populationRank }));
  if (profile.seasonCount > 1 && profile.signals?.missingAdvanced >= 5 && player.overall < profile.baseOverall - 5) warnings.push(warning(player, "CURRENT_MISSING_DATA_OVERPENALIZED", { missingAdvanced: profile.signals.missingAdvanced, baseOverall: profile.baseOverall }));
  if (population.length) { const position = player.primaryPosition || player.normalizedInput?.primaryPosition; const rows = population.filter((item) => (item.primaryPosition || item.normalizedInput?.primaryPosition) === position); const league = population.reduce((sum, item) => sum + item.overall, 0) / population.length; const positional = rows.reduce((sum, item) => sum + item.overall, 0) / Math.max(1, rows.length); if (positional > league + 5 && player.overall >= 85) warnings.push(warning(player, "POSITION_DISTORTION", { position, positionalAverage: round(positional), leagueAverage: round(league) })); }
  return warnings;
}

export function buildV24WarningReport(players) {
  const warnings = players.flatMap((player) => player.outliers || []); const groups = Object.values(V24_WARNING_DEFINITIONS).length ? Object.keys(V24_WARNING_DEFINITIONS).map((code) => { const items = warnings.filter((item) => item.code === code); const definition = V24_WARNING_DEFINITIONS[code]; return { code, severity: definition[0], title: definition[1], explanation: definition[2], suggestedArea: definition[3], count: items.length, players: items }; }).filter((group) => group.count) : [];
  return { criticalIssues: warnings.filter((item) => item.severity === "CRITICAL"), warnings: warnings.filter((item) => item.severity !== "CRITICAL"), groups, approvalEligible: warnings.every((item) => item.severity !== "CRITICAL") };
}
