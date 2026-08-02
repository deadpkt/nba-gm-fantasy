const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const round = (value, precision = 3) => Math.round(value * 10 ** precision) / 10 ** precision;
const meanRating = (ratings, keys) => average(keys.map((key) => ratings[key]).filter(Number.isFinite));

export const V23_DOMAIN_KEYS = Object.freeze({
  scoring: ["rimScoring", "midRange", "threePoint", "freeThrow"],
  creation: ["playmaking", "ballHandling", "turnoverControl"],
  perimeterDefense: ["perimeterDefense", "steal"],
  interiorDefense: ["interiorDefense", "block"],
  rebounding: ["offensiveRebounding", "defensiveRebounding"],
  physicalReliability: ["athleticism", "stamina", "consistency"],
});

export const V23_ROLE_RANGES = Object.freeze({
  PRIMARY_STAR: [89, 99], SECONDARY_STAR: [85, 94], HIGH_LEVEL_STARTER: [82, 90], STARTER: [77, 86],
  ROTATION_SPECIALIST: [73, 82], ROTATION_PLAYER: [70, 79], BENCH_PLAYER: [66, 75], FRINGE_PLAYER: [60, 70], INSUFFICIENT_DATA: [60, 75],
});

export const V23_ROLE_RANK_BANDS = Object.freeze({
  PRIMARY_STAR: [1, 30], SECONDARY_STAR: [10, 70], HIGH_LEVEL_STARTER: [30, 140], STARTER: [70, 250],
  ROTATION_SPECIALIST: [100, 499], ROTATION_PLAYER: [120, 499], BENCH_PLAYER: [180, 499], FRINGE_PLAYER: [250, 499], INSUFFICIENT_DATA: [250, 499],
});

const tierFor = (overall) => overall >= 96 ? "TIER_S" : overall >= 92 ? "TIER_A_PLUS" : overall >= 88 ? "TIER_A" : overall >= 84 ? "TIER_B_PLUS" : overall >= 80 ? "TIER_B" : overall >= 76 ? "TIER_C_PLUS" : overall >= 72 ? "TIER_C" : overall >= 68 ? "TIER_D" : "TIER_E";
const ratio = (value, low, high) => clamp((Number(value) - low) / (high - low));
const optionalRatio = (value, low, high, fallback) => value === null || value === undefined ? fallback : ratio(value, low, high);

export function buildV23Domains(ratings) {
  const domains = Object.fromEntries(Object.entries(V23_DOMAIN_KEYS).map(([key, keys]) => [key, round(meanRating(ratings, keys), 2)]));
  const values = Object.values(domains);
  return {
    domains,
    eliteDomainCount: values.filter((value) => value >= 90).length,
    strongDomainCount: values.filter((value) => value >= 82).length,
    averageDomainCount: values.filter((value) => value >= 70 && value < 82).length,
    weakDomainCount: values.filter((value) => value < 62).length,
  };
}

export function buildV23Evidence(ratings, stats, confidence) {
  const breadth = buildV23Domains(ratings);
  const startRate = stats.gamesStarted > 0 && stats.gamesPlayed ? clamp(stats.gamesStarted / stats.gamesPlayed) : ratio(stats.minutesPerGame, 20, 32);
  const workload = round(average([ratio(stats.minutesPerGame, 10, 36), ratio(stats.gamesPlayed, 8, 72), ratio(stats.totalMinutes ?? stats.gamesPlayed * stats.minutesPerGame, 200, 2400), startRate]));
  const scoringLoad = ratio(stats.pointsPerGame, 7, 30);
  const assistLoad = ratio(stats.assistsPerGame, 1, 9);
  const usage = optionalRatio(stats.usageRate, .14, .34, scoringLoad * .65 + assistLoad * .35);
  const touches = optionalRatio(stats.trackingMetrics?.touches, 25, 85, usage);
  const drives = optionalRatio(stats.driveFrequency, 1, 16, scoringLoad * .65);
  const responsibility = round(scoringLoad * .28 + assistLoad * .22 + usage * .22 + touches * .1 + drives * .08 + ratio(stats.freeThrowAttemptsPerGame, 1, 8) * .1);
  const trueShooting = stats.trueShootingPercentage;
  const effectiveFieldGoal = stats.effectiveFieldGoalPercentage ?? stats.fieldGoalPercentage;
  const fallbackShootingEfficiency = average([optionalRatio(stats.fieldGoalPercentage, .4, .58, .45), optionalRatio(stats.threePointPercentage, .28, .43, .45), optionalRatio(stats.freeThrowPercentage, .62, .9, .45)]);
  const shootingEfficiency = trueShooting === null || trueShooting === undefined ? fallbackShootingEfficiency : optionalRatio(trueShooting, .49, .66, fallbackShootingEfficiency);
  const turnoverRate = optionalRatio(stats.turnoverPercentage, .22, .08, ratio((stats.assistsPerGame || 0) / Math.max(.75, stats.turnoversPerGame || .75), .7, 4));
  const roleEfficiency = round(shootingEfficiency * .72 + turnoverRate * .28);
  const defense = Math.max(breadth.domains.perimeterDefense, breadth.domains.interiorDefense);
  const defensiveImpact = round(clamp((defense - 60) / 35) * .72 + clamp((breadth.domains.rebounding - 62) / 32) * .28);
  const offense = breadth.domains.scoring * .58 + breadth.domains.creation * .42;
  const twoWayImpact = round(clamp((offense - 67) / 25) * clamp((defense - 67) / 25));
  const coverage = clamp((confidence.coreCoverage ?? 0) * .65 + (confidence.advancedCoverage ?? 0) * .35);
  const reliability = round(confidence.score * .52 + workload * .3 + coverage * .18);
  const independentSkillBreadth = round(clamp((breadth.eliteDomainCount * .35 + breadth.strongDomainCount + breadth.averageDomainCount * .35) / 6));
  const severeWeakness = breadth.weakDomainCount >= 2 ? clamp((breadth.weakDomainCount - 1) / 4) : 0;
  const missingAdvanced = [stats.usageRate, stats.trueShootingPercentage, stats.effectiveFieldGoalPercentage, stats.turnoverPercentage, stats.trackingMetrics, stats.hustleMetrics, stats.defensiveDistanceMetrics].filter((value) => value === null || value === undefined).length;
  return { ...breadth, workload, startRate: round(startRate), scoringLoad, assistLoad, usage: round(usage), responsibility, roleEfficiency, defensiveImpact, twoWayImpact, reliability, independentSkillBreadth, severeWeakness, missingAdvanced, trueShooting, effectiveFieldGoal };
}

export function classifyRoleV23(evidence, stats, confidence) {
  if (confidence.status === "insufficient_data") return "INSUFFICIENT_DATA";
  if (stats.minutesPerGame < 12 || evidence.workload < .18) return confidence.status === "verified" ? "FRINGE_PLAYER" : "INSUFFICIENT_DATA";
  if (stats.minutesPerGame < 17 || evidence.workload < .3) return "BENCH_PLAYER";
  const starEvidence = evidence.reliability >= .68 && evidence.roleEfficiency >= .42 && evidence.strongDomainCount >= 2;
  if (starEvidence && evidence.responsibility >= .78 && evidence.workload >= .72 && (evidence.independentSkillBreadth >= .5 || evidence.twoWayImpact >= .58)) return "PRIMARY_STAR";
  if (starEvidence && evidence.workload >= .62 && ((evidence.responsibility >= .6 && evidence.roleEfficiency >= .48) || evidence.twoWayImpact >= .62)) return "SECONDARY_STAR";
  if (evidence.workload >= .56 && evidence.strongDomainCount >= 2 && (evidence.roleEfficiency >= .4 || evidence.defensiveImpact >= .62)) return "HIGH_LEVEL_STARTER";
  if (evidence.workload >= .48 || (stats.minutesPerGame >= 26 && evidence.startRate >= .45)) return "STARTER";
  if ((evidence.eliteDomainCount >= 1 || evidence.strongDomainCount >= 2) && evidence.independentSkillBreadth < .5) return "ROTATION_SPECIALIST";
  if (evidence.workload >= .32 || stats.minutesPerGame >= 19) return "ROTATION_PLAYER";
  return "BENCH_PLAYER";
}

function weightedCoreSkill(domains) {
  const offense = domains.scoring * .34 + domains.creation * .26;
  const defense = Math.max(domains.perimeterDefense, domains.interiorDefense) * .2 + Math.min(domains.perimeterDefense, domains.interiorDefense) * .04;
  return offense + defense + domains.rebounding * .08 + domains.physicalReliability * .08;
}

export function calibrateOverallV23({ ratings, stats, confidence }) {
  const evidence = buildV23Evidence(ratings, stats, confidence);
  const role = classifyRoleV23(evidence, stats, confidence);
  const coreSkillValue = weightedCoreSkill(evidence.domains);
  const responsibilityAdjustment = (evidence.responsibility - .5) * 11 + (evidence.workload - .5) * 5;
  const efficiencyAdjustment = (evidence.roleEfficiency - .5) * (4 + evidence.responsibility * 5);
  const impactAdjustment = (evidence.twoWayImpact - .28) * 4 + (evidence.defensiveImpact - .45) * 2;
  const reliabilityAdjustment = (evidence.reliability - .65) * 7;
  const breadthAdjustment = (evidence.independentSkillBreadth - .42) * 5;
  const weaknessPenalty = evidence.severeWeakness * 4;
  const lowUsageEfficiencyPenalty = evidence.usage < .28 && evidence.roleEfficiency > .7 ? (0.28 - evidence.usage) * 10 : 0;
  const inefficientVolumePenalty = evidence.responsibility > .65 && evidence.roleEfficiency < .4 ? (evidence.responsibility - .65) * 7 + (.4 - evidence.roleEfficiency) * 8 : 0;
  const missingDataPenalty = Math.max(0, evidence.missingAdvanced - 3) * .35;
  const rawSkillOverall = coreSkillValue;
  let totalValue = coreSkillValue + 2 + responsibilityAdjustment + efficiencyAdjustment + impactAdjustment + reliabilityAdjustment + breadthAdjustment - weaknessPenalty - lowUsageEfficiencyPenalty - inefficientVolumePenalty - missingDataPenalty;
  const starQualified = confidence.status === "verified" && stats.gamesPlayed >= 30 && stats.minutesPerGame >= 27 && evidence.reliability >= .68 && evidence.strongDomainCount >= 2 && evidence.roleEfficiency >= .46 && (evidence.responsibility >= .62 || evidence.twoWayImpact >= .6) && evidence.missingAdvanced <= 5;
  const mvpQualified = starQualified && stats.gamesPlayed >= 40 && stats.minutesPerGame >= 29 && evidence.reliability >= .78 && evidence.strongDomainCount >= 3 && evidence.independentSkillBreadth >= .6 && evidence.roleEfficiency >= .68 && (evidence.responsibility >= .82 || evidence.twoWayImpact >= .76);
  const eliteEvidence = clamp((evidence.responsibility - .58) / .32) * .3 + clamp((evidence.roleEfficiency - .46) / .34) * .2 + clamp((evidence.independentSkillBreadth - .42) / .42) * .2 + clamp((evidence.reliability - .65) / .3) * .15 + clamp((Math.max(evidence.twoWayImpact, evidence.defensiveImpact) - .48) / .45) * .15;
  const upperTailBoost = starQualified ? clamp((totalValue - 84) / 8) * eliteEvidence * 4 : 0;
  totalValue += upperTailBoost;
  const [softLow, softHigh] = V23_ROLE_RANGES[role];
  if (totalValue > softHigh) totalValue = softHigh + (totalValue - softHigh) * (mvpQualified ? .2 : starQualified ? .1 : .05);
  if (totalValue < softLow) totalValue = softLow - (softLow - totalValue) * .1;
  if (!starQualified) totalValue = Math.min(totalValue, confidence.status === "verified" ? 89 : 82);
  if (!mvpQualified) totalValue = Math.min(totalValue, 94);
  else totalValue = Math.min(totalValue, 98);
  if (stats.minutesPerGame < 22) totalValue = Math.min(totalValue, 80);
  if (confidence.status === "provisional") totalValue = Math.min(totalValue, 82);
  if (confidence.status === "insufficient_data") totalValue = Math.min(totalValue, 75);
  const overall = Math.max(25, Math.min(99, Math.round(totalValue)));
  const strengths = Object.entries(evidence.domains).filter(([, value]) => value >= 80).toSorted((a, b) => b[1] - a[1]).slice(0, 4).map(([key]) => `strong ${key.replace(/([A-Z])/g, " $1").toLowerCase()}`);
  const limiters = [];
  if (evidence.usage < .35) limiters.push("limited offensive responsibility");
  if (evidence.roleEfficiency < .42) limiters.push("weak role-adjusted efficiency");
  if (evidence.independentSkillBreadth < .38) limiters.push("one-domain or narrow impact");
  if (evidence.workload < .5) limiters.push("limited workload evidence");
  if (evidence.missingAdvanced >= 4) limiters.push("missing advanced context");
  if (confidence.status !== "verified") limiters.push(`${confidence.status.replaceAll("_", " ")} confidence`);
  return { overall, role, tier: tierFor(overall), signals: evidence, starQualified, mvpQualified, roleRange: V23_ROLE_RANGES[role], coreSkillValue: round(coreSkillValue, 2), rawSkillOverall: round(rawSkillOverall, 2), responsibilityAdjustment: round(responsibilityAdjustment, 2), efficiencyAdjustment: round(efficiencyAdjustment, 2), impactAdjustment: round(impactAdjustment, 2), reliabilityAdjustment: round(reliabilityAdjustment, 2), breadthAdjustment: round(breadthAdjustment, 2), weaknessPenalty: round(weaknessPenalty, 2), lowUsageEfficiencyPenalty: round(lowUsageEfficiencyPenalty, 2), inefficientVolumePenalty: round(inefficientVolumePenalty, 2), missingDataPenalty: round(missingDataPenalty, 2), upperTailBoost: round(upperTailBoost, 2), explanation: { strengths, limiters } };
}

const issue = (player, severity, reason, suggestedArea) => ({ playerId: player.playerId, name: player.name, overall: player.overall, role: player.calibrationProfile?.role, tier: player.calibrationProfile?.tier, severity, reason, suggestedArea });

export function buildRatingOutliersV23(player, population = []) {
  const issues = [];
  const stats = player.normalizedInput || {}; const profile = player.calibrationProfile || {}; const signals = profile.signals || {};
  if (player.overall >= 90 && !profile.starQualified) issues.push(issue(player, "CRITICAL", "UNJUSTIFIED_SUPERSTAR_OVR", "Elite qualification"));
  if (player.overall > (profile.roleRange?.[1] ?? 99) + 1) issues.push(issue(player, "CRITICAL", "ROLE_OVR_MISMATCH", "Role-aware soft range"));
  if (player.overall >= 82 && signals.usage < .28) issues.push(issue(player, "WARNING", "LOW_USAGE_HIGH_OVR", "Responsibility layer"));
  if (player.overall >= 80 && (stats.minutesPerGame || 0) < 22) issues.push(issue(player, "WARNING", "LOW_MINUTES_HIGH_OVR", "Reliability layer"));
  if (player.overall > 82 && player.ratingsStatus !== "verified") issues.push(issue(player, "CRITICAL", "PROVISIONAL_HIGH_OVR", "Evidence ceiling"));
  if (player.overall >= 84 && (signals.strongDomainCount || 0) <= 1) issues.push(issue(player, "WARNING", "ONE_DOMAIN_INFLATION", "Independent domain breadth"));
  const eliteAttributes = Object.entries(player.ratings || {}).filter(([key, value]) => key !== "overall" && Number.isInteger(value) && value >= 90).length;
  if (player.overall >= 84 && eliteAttributes >= 3 && (signals.eliteDomainCount || 0) <= 1) issues.push(issue(player, "WARNING", "CORRELATED_DOMAIN_INFLATION", "Correlated attribute grouping"));
  if (player.overall >= 86 && (signals.responsibility || 0) > .65 && (signals.roleEfficiency || 0) < .4) issues.push(issue(player, "WARNING", "HIGH_USAGE_LOW_EFFICIENCY", "Role-adjusted efficiency"));
  if (player.overall >= 88 && (signals.missingAdvanced || 0) >= 5) issues.push(issue(player, "CRITICAL", "MISSING_DATA_ELITE_OVR", "Advanced-data evidence"));
  const band = V23_ROLE_RANK_BANDS[profile.role];
  if (band && player.populationRank && (player.populationRank < band[0] || player.populationRank > band[1])) issues.push(issue(player, player.overall >= 90 && player.populationRank < band[0] - 35 ? "CRITICAL" : "WARNING", "RANK_ROLE_CONTRADICTION", "Expected role rank band"));
  if (population.length && profile.role?.includes("ROTATION") && player.populationRank <= 100) issues.push(issue(player, "WARNING", "SPECIALIST_ABOVE_STAR", "Population hierarchy"));
  if ((signals.twoWayImpact || 0) >= .65 && player.overall < 84) issues.push(issue(player, "WARNING", "TWO_WAY_PLAYER_UNDERRATED", "Two-way impact layer"));
  if ((signals.responsibility || 0) >= .75 && (signals.domains?.creation || 0) >= 85 && player.overall < 85) issues.push(issue(player, "WARNING", "CREATOR_UNDERRATED", "Creation responsibility"));
  if (population.length) {
    const position = player.primaryPosition || stats.primaryPosition; const positionRows = population.filter((item) => (item.primaryPosition || item.normalizedInput?.primaryPosition) === position);
    const leagueAverage = average(population.map((item) => item.overall)); const positionAverage = average(positionRows.map((item) => item.overall));
    if (positionAverage > leagueAverage + 5 && player.overall >= 85) issues.push(issue(player, "WARNING", "POSITIONAL_INFLATION", "Position distribution"));
  }
  return issues;
}

export function buildV23RealismReport(players) {
  const queue = players.flatMap((player) => player.outliers || []);
  const positions = [...new Set(players.map((player) => player.primaryPosition || player.normalizedInput?.primaryPosition).filter(Boolean))].toSorted();
  const positionAverages = Object.fromEntries(positions.map((position) => { const rows = players.filter((player) => (player.primaryPosition || player.normalizedInput?.primaryPosition) === position); return [position, round(average(rows.map((player) => player.overall)), 2)]; }));
  const spread = Math.max(...Object.values(positionAverages)) - Math.min(...Object.values(positionAverages));
  const criticalIssues = queue.filter((item) => item.severity === "CRITICAL");
  const warnings = queue.filter((item) => item.severity !== "CRITICAL");
  const score = (bad, total, weight = 100) => Math.max(0, 100 - bad / Math.max(1, total) * weight);
  const categoryScores = {
    roleOverallConsistency: round(score(queue.filter((item) => item.reason === "ROLE_OVR_MISMATCH").length, players.length, 300), 1),
    rankBandConsistency: round(score(queue.filter((item) => item.reason === "RANK_ROLE_CONTRADICTION").length, players.length, 180), 1),
    confidenceConsistency: round(score(queue.filter((item) => ["PROVISIONAL_HIGH_OVR", "MISSING_DATA_ELITE_OVR"].includes(item.reason)).length, players.length, 300), 1),
    workloadConsistency: round(score(queue.filter((item) => ["LOW_USAGE_HIGH_OVR", "LOW_MINUTES_HIGH_OVR"].includes(item.reason)).length, players.length, 180), 1),
    specialistCeiling: round(score(queue.filter((item) => ["ONE_DOMAIN_INFLATION", "SPECIALIST_ABOVE_STAR"].includes(item.reason)).length, players.length, 220), 1),
    positionFairness: round(Math.max(0, 100 - Math.max(0, spread - 3) * 8), 1),
    missingDataSafety: round(score(queue.filter((item) => item.reason === "MISSING_DATA_ELITE_OVR").length, players.length, 400), 1),
    eliteQualification: round(score(queue.filter((item) => item.reason === "UNJUSTIFIED_SUPERSTAR_OVR").length, players.length, 500), 1),
  };
  return { realismScore: round(average(Object.values(categoryScores)), 1), criticalIssues, warnings, categoryScores, positionAverages, approvalEligible: criticalIssues.length === 0 };
}
