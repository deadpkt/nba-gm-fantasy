const ADVANCED_GROUPS = Object.freeze([
  ["usageRate", "trueShootingPercentage", "effectiveFieldGoalPercentage"],
  ["assistPercentage", "turnoverPercentage"],
  ["offensiveReboundPercentage", "defensiveReboundPercentage"],
  ["rimFrequency", "rimEfficiency", "midRangeFrequency", "midRangeEfficiency", "threePointFrequency", "threePointEfficiency"],
  ["catchAndShootFrequency", "pullUpFrequency"],
  ["driveFrequency", "driveEfficiency", "postUpFrequency", "postUpEfficiency"],
  ["passingMetrics", "trackingMetrics"],
  ["hustleMetrics", "defensiveDistanceMetrics"],
]);

const present = (value) => value !== null && value !== undefined && (typeof value !== "object" || Object.values(value).some((item) => item !== null && item !== undefined));
const clamp01 = (value) => Math.max(0, Math.min(1, value));

export function calculateRatingsConfidenceV2(stats) {
  const games = Math.max(0, Number(stats.gamesPlayed) || 0);
  const minutes = Math.max(0, Number(stats.minutesPerGame) || 0);
  const starts = Math.max(0, Number(stats.gamesStarted) || 0);
  const totalMinutes = stats.totalMinutes !== null && stats.totalMinutes !== undefined && Number.isFinite(Number(stats.totalMinutes)) ? Number(stats.totalMinutes) : games * minutes;
  const coreFields = ["pointsPerGame", "assistsPerGame", "turnoversPerGame", "fieldGoalPercentage", "threePointPercentage", "threePointAttemptsPerGame", "freeThrowPercentage", "offensiveReboundsPerGame", "defensiveReboundsPerGame", "stealsPerGame", "blocksPerGame"];
  const coreCoverage = coreFields.filter((key) => present(stats[key])).length / coreFields.length;
  const advancedGroupsAvailable = ADVANCED_GROUPS.filter((group) => group.some((key) => present(stats[key]))).length;
  const advancedCoverage = advancedGroupsAvailable / ADVANCED_GROUPS.length;
  const score = Math.round(clamp01(
    clamp01(games / 55) * .32 + clamp01(totalMinutes / 1500) * .28 + clamp01(minutes / 30) * .14 +
    clamp01(starts / Math.max(1, games)) * .08 + coreCoverage * .1 + advancedCoverage * .08,
  ) * 100) / 100;
  const reasons = [];
  if (games < 10) reasons.push("limited games sample");
  if (totalMinutes < 300) reasons.push("limited total minutes");
  if (minutes < 12) reasons.push("low-minute role");
  if (coreCoverage < .9) reasons.push("incomplete core statistics");
  if (advancedCoverage < .5) reasons.push("limited advanced-category coverage");
  if (!reasons.length) reasons.push("stable workload and category coverage");
  const status = games < 3 || totalMinutes < 40 || coreCoverage < .55 ? "insufficient_data"
    : games >= 20 && totalMinutes >= 500 && coreCoverage >= .9 && advancedCoverage >= .375 ? "verified" : "provisional";
  return Object.freeze({ level: score >= .72 ? "high" : score >= .4 ? "medium" : "low", score, reasons, status, coreCoverage, advancedCoverage, advancedGroupsAvailable, totalMinutes });
}
