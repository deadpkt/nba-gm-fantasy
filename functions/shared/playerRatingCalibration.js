const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const meanRating = (ratings, keys) => average(keys.map((key) => ratings[key]).filter(Number.isFinite));

const GROUPS = Object.freeze({
  scoring: ["rimScoring", "midRange", "threePoint", "freeThrow"],
  creation: ["playmaking", "ballHandling", "turnoverControl"],
  perimeterDefense: ["perimeterDefense", "steal"],
  interiorDefense: ["interiorDefense", "block"],
  rebounding: ["offensiveRebounding", "defensiveRebounding"],
  physical: ["athleticism", "stamina", "consistency"],
});

const groupScores = (ratings) => Object.fromEntries(Object.entries(GROUPS).map(([key, keys]) => [key, meanRating(ratings, keys)]));
const countAt = (values, threshold) => values.filter((value) => value >= threshold).length;

function impactSignals(ratings, stats, confidence) {
  const groups = groupScores(ratings);
  const minutes = clamp((stats.minutesPerGame - 10) / 26);
  const availability = clamp((stats.gamesPlayed - 10) / 55);
  const scoringLoad = clamp((stats.pointsPerGame - 8) / 22);
  const creationLoad = clamp(((stats.assistsPerGame || 0) - 1) / 7);
  const touches = clamp(((stats.trackingMetrics?.touches || 20) - 20) / 60);
  const drives = clamp(((stats.driveFrequency || 1) - 1) / 15);
  const foulPressure = clamp(((stats.freeThrowAttemptsPerGame || 1) - 1) / 7);
  const responsibility = clamp(scoringLoad * .34 + creationLoad * .28 + touches * .17 + drives * .12 + foulPressure * .09);
  const scoringEfficiency = clamp(((stats.fieldGoalPercentage || .42) - .39) / .19) * .5 + clamp(((stats.threePointPercentage || .3) - .27) / .16) * .22 + clamp(((stats.freeThrowPercentage || .68) - .58) / .32) * .13 + clamp(((stats.rimEfficiency || .55) - .5) / .25) * .15;
  const efficiencyAtRole = clamp(scoringEfficiency * .72 + (1 - clamp((stats.turnoversPerGame || 0) / Math.max(1, (stats.assistsPerGame || 0) + 2))) * .28);
  const independentGroups = Object.values(groups);
  const eliteSkillsCount = countAt(independentGroups, 90);
  const strongSkillsCount = countAt(independentGroups, 82);
  const majorWeaknessCount = independentGroups.filter((value) => value < 62).length;
  const offensiveBreadth = clamp((countAt([groups.scoring, groups.creation], 80) + responsibility) / 3);
  const defensiveBreadth = clamp((countAt([groups.perimeterDefense, groups.interiorDefense, groups.rebounding], 80) + Math.max(groups.perimeterDefense, groups.interiorDefense, groups.rebounding) / 100) / 4);
  const twoWayImpact = clamp((meanRating(ratings, [...GROUPS.scoring, ...GROUPS.creation]) - 68) / 24) * clamp((meanRating(ratings, [...GROUPS.perimeterDefense, ...GROUPS.interiorDefense, ...GROUPS.rebounding]) - 68) / 24);
  const roleBreadth = clamp((strongSkillsCount + eliteSkillsCount * .5) / 5);
  const reliability = clamp(confidence.score * .55 + minutes * .2 + availability * .15 + clamp(confidence.coverage || 0) * .1);
  return { groups, minutes, availability, responsibility, efficiencyAtRole, eliteSkillsCount, strongSkillsCount, majorWeaknessCount, offensiveBreadth, defensiveBreadth, twoWayImpact, roleBreadth, reliability };
}

function classifyRole(signals, stats, confidence) {
  if (confidence.status === "insufficient_data") return "INSUFFICIENT_DATA";
  if (signals.minutes < .18 || stats.minutesPerGame < 15) return confidence.status === "verified" ? "FRINGE_PLAYER" : "INSUFFICIENT_DATA";
  if (signals.minutes < .38 || stats.minutesPerGame < 21) return "BENCH_PLAYER";
  if (signals.responsibility >= .78 && signals.minutes >= .7 && signals.roleBreadth >= .5) return "PRIMARY_STAR";
  if ((signals.responsibility >= .6 && signals.minutes >= .62) || (signals.twoWayImpact >= .7 && signals.minutes >= .62)) return "SECONDARY_STAR";
  if (signals.minutes >= .58 && signals.strongSkillsCount >= 3) return "HIGH_LEVEL_STARTER";
  if (signals.minutes >= .5) return "STARTER";
  if (signals.eliteSkillsCount >= 1 && signals.roleBreadth < .55) return "ROTATION_SPECIALIST";
  if (signals.minutes >= .32) return "ROTATION_PLAYER";
  return "BENCH_PLAYER";
}

const ROLE_CAPS = Object.freeze({ PRIMARY_STAR: 99, SECONDARY_STAR: 95, HIGH_LEVEL_STARTER: 91, STARTER: 87, ROTATION_SPECIALIST: 84, ROTATION_PLAYER: 82, BENCH_PLAYER: 78, FRINGE_PLAYER: 73, INSUFFICIENT_DATA: 70 });
const ROLE_BONUSES = Object.freeze({ PRIMARY_STAR: 4, SECONDARY_STAR: 2, HIGH_LEVEL_STARTER: 1, STARTER: 0, ROTATION_SPECIALIST: 0, ROTATION_PLAYER: 0, BENCH_PLAYER: 0, FRINGE_PLAYER: 0, INSUFFICIENT_DATA: 0 });
const tierFor = (overall) => overall >= 96 ? "TIER_S" : overall >= 92 ? "TIER_A_PLUS" : overall >= 88 ? "TIER_A" : overall >= 84 ? "TIER_B_PLUS" : overall >= 80 ? "TIER_B" : overall >= 76 ? "TIER_C_PLUS" : overall >= 72 ? "TIER_C" : overall >= 68 ? "TIER_D" : "TIER_E";

export function calibrateOverallV22({ ratings, stats, confidence, baseOverall }) {
  const signals = impactSignals(ratings, stats, confidence);
  const role = classifyRole(signals, stats, confidence);
  const independentImpact = average(Object.values(signals.groups));
  const roleAdjustment = Math.max(0, signals.responsibility - .45) * 5 + (signals.efficiencyAtRole - .5) * 2.5 + Math.max(0, signals.roleBreadth - .45) * 3 + Math.max(0, signals.twoWayImpact - .25) * 2 + ROLE_BONUSES[role];
  const skillAdjustment = (independentImpact - baseOverall) * .18;
  let overall = Math.round(baseOverall + roleAdjustment + skillAdjustment);
  const starQualified = confidence.status === "verified" && stats.gamesPlayed >= 30 && stats.minutesPerGame >= 27 && signals.reliability >= .68 && signals.strongSkillsCount >= 3 && (signals.responsibility >= .58 || signals.twoWayImpact >= .58);
  const mvpQualified = starQualified && stats.gamesPlayed >= 40 && stats.minutesPerGame >= 29 && signals.roleBreadth >= .65 && (signals.responsibility >= .78 || signals.twoWayImpact >= .78) && signals.efficiencyAtRole >= .55;
  if (!starQualified) overall = Math.min(overall, 89);
  if (!mvpQualified) overall = Math.min(overall, 95);
  overall = Math.min(overall, ROLE_CAPS[role]);
  overall = Math.max(25, Math.min(99, overall));
  const strengths = Object.entries(signals.groups).filter(([, value]) => value >= 80).toSorted((a, b) => b[1] - a[1]).slice(0, 4).map(([key]) => `strong ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`);
  const limiters = [];
  if (signals.responsibility < .42) limiters.push("limited offensive responsibility");
  if (signals.minutes < .5) limiters.push("limited workload");
  if (signals.roleBreadth < .4) limiters.push("narrow role breadth");
  if (signals.majorWeaknessCount >= 2) limiters.push("multiple major weaknesses");
  if (confidence.status !== "verified") limiters.push(`${confidence.status.replaceAll("_", " ")} confidence`);
  return { overall, role, tier: tierFor(overall), signals, starQualified, mvpQualified, roleCap: ROLE_CAPS[role], explanation: { strengths, limiters } };
}

export function buildRatingOutliers(player) {
  const reasons = [];
  const stats = player.normalizedInput || {};
  const profile = player.calibrationProfile || {};
  if (player.overall >= 90 && !profile.starQualified) reasons.push(["CRITICAL", "UNEXPECTED_ELITE_OVR", "Review star qualification gates"]);
  if (player.overall >= 82 && (stats.minutesPerGame || 0) < 22) reasons.push(["WARNING", "LOW_MINUTES_HIGH_OVR", "Review workload and role ceiling"]);
  if (player.overall >= 85 && player.ratingsStatus !== "verified") reasons.push(["CRITICAL", "PROVISIONAL_TOP_TIER", "Review reliability regression"]);
  if (player.overall >= 85 && (profile.signals?.eliteSkillsCount || 0) <= 1 && (profile.signals?.strongSkillsCount || 0) <= 2) reasons.push(["WARNING", "ONE_SKILL_OVR_INFLATION", "Review correlated skill breadth"]);
  if (player.overall > (profile.roleCap ?? 99)) reasons.push(["CRITICAL", "ROLE_OVR_MISMATCH", "Review role ceiling"]);
  if ((profile.signals?.responsibility || 0) >= .7 && (profile.signals?.efficiencyAtRole || 0) < .35 && player.overall >= 88) reasons.push(["WARNING", "HIGH_USAGE_LOW_EFFICIENCY", "Review role-adjusted efficiency"]);
  if ((player.calibrationDiagnostics?.missingAttributes?.length || 0) >= 5) reasons.push(["WARNING", "ADVANCED_DATA_MISSING", "Review provider category normalization"]);
  return reasons.map(([severity, reason, suggestedArea]) => ({ playerId: player.playerId, name: player.name, overall: player.overall, role: profile.role, tier: profile.tier, severity, reason, suggestedArea }));
}

export const PLAYER_RATING_TIERS = Object.freeze(["TIER_S", "TIER_A_PLUS", "TIER_A", "TIER_B_PLUS", "TIER_B", "TIER_C_PLUS", "TIER_C", "TIER_D", "TIER_E"]);
export const PLAYER_ROLES = Object.freeze(Object.keys(ROLE_CAPS));
