const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const percentage = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = finite(value);
  return number > 1 ? number / 100 : number;
};
const optionalFinite = (value) => value === null || value === undefined || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const optionalPercentage = (value) => {
  const number = optionalFinite(value);
  return number === null ? null : number > 1 ? number / 100 : number;
};

export const NORMALIZED_SEASON_STAT_FIELDS = Object.freeze([
  "provider", "externalPlayerId", "season", "gamesPlayed", "gamesStarted", "minutesPerGame",
  "pointsPerGame", "assistsPerGame", "turnoversPerGame", "fieldGoalPercentage",
  "threePointPercentage", "threePointAttemptsPerGame", "freeThrowPercentage",
  "freeThrowAttemptsPerGame", "offensiveReboundsPerGame", "defensiveReboundsPerGame",
  "stealsPerGame", "blocksPerGame", "totalMinutes", "usageRate", "trueShootingPercentage",
  "effectiveFieldGoalPercentage", "assistPercentage", "turnoverPercentage", "offensiveReboundPercentage",
  "defensiveReboundPercentage", "rimFrequency", "rimEfficiency", "midRangeFrequency", "midRangeEfficiency",
  "threePointFrequency", "threePointEfficiency", "catchAndShootFrequency", "catchAndShootEfficiency",
  "pullUpFrequency", "pullUpEfficiency", "driveFrequency", "driveEfficiency", "postUpFrequency", "postUpEfficiency",
  "passingMetrics", "trackingMetrics", "hustleMetrics", "defensiveDistanceMetrics", "gameLogVariance",
  "primaryPosition", "eligiblePositions", "position", "team", "sourceCategoryCoverage",
]);

export function normalizeSeasonStatRecord(input = {}) {
  const provider = String(input.provider || "").trim();
  const externalPlayerId = input.externalPlayerId === null || input.externalPlayerId === undefined ? "" : String(input.externalPlayerId).trim();
  const season = String(input.season || "").trim();
  if (!provider || !externalPlayerId || !season) throw new Error("Provider, player identity, and season are required for verified ratings.");
  const record = {
    provider, externalPlayerId, season,
    gamesPlayed: Math.max(0, Math.round(finite(input.gamesPlayed))),
    gamesStarted: Math.max(0, Math.round(finite(input.gamesStarted))),
    minutesPerGame: Math.max(0, finite(input.minutesPerGame)),
    pointsPerGame: Math.max(0, finite(input.pointsPerGame)),
    assistsPerGame: Math.max(0, finite(input.assistsPerGame)),
    turnoversPerGame: Math.max(0, finite(input.turnoversPerGame)),
    fieldGoalPercentage: percentage(input.fieldGoalPercentage),
    threePointPercentage: percentage(input.threePointPercentage),
    threePointAttemptsPerGame: Math.max(0, finite(input.threePointAttemptsPerGame)),
    freeThrowPercentage: percentage(input.freeThrowPercentage),
    freeThrowAttemptsPerGame: Math.max(0, finite(input.freeThrowAttemptsPerGame)),
    offensiveReboundsPerGame: Math.max(0, finite(input.offensiveReboundsPerGame)),
    defensiveReboundsPerGame: Math.max(0, finite(input.defensiveReboundsPerGame)),
    stealsPerGame: Math.max(0, finite(input.stealsPerGame)),
    blocksPerGame: Math.max(0, finite(input.blocksPerGame)),
    totalMinutes: optionalFinite(input.totalMinutes),
    usageRate: optionalPercentage(input.usageRate), trueShootingPercentage: optionalPercentage(input.trueShootingPercentage),
    effectiveFieldGoalPercentage: optionalPercentage(input.effectiveFieldGoalPercentage), assistPercentage: optionalPercentage(input.assistPercentage),
    turnoverPercentage: optionalPercentage(input.turnoverPercentage), offensiveReboundPercentage: optionalPercentage(input.offensiveReboundPercentage),
    defensiveReboundPercentage: optionalPercentage(input.defensiveReboundPercentage), rimFrequency: optionalPercentage(input.rimFrequency),
    rimEfficiency: optionalPercentage(input.rimEfficiency), midRangeFrequency: optionalPercentage(input.midRangeFrequency),
    midRangeEfficiency: optionalPercentage(input.midRangeEfficiency), threePointFrequency: optionalPercentage(input.threePointFrequency),
    threePointEfficiency: optionalPercentage(input.threePointEfficiency), catchAndShootFrequency: optionalPercentage(input.catchAndShootFrequency),
    catchAndShootEfficiency: optionalPercentage(input.catchAndShootEfficiency), pullUpFrequency: optionalPercentage(input.pullUpFrequency),
    pullUpEfficiency: optionalPercentage(input.pullUpEfficiency), driveFrequency: optionalFinite(input.driveFrequency),
    driveEfficiency: optionalFinite(input.driveEfficiency), postUpFrequency: optionalFinite(input.postUpFrequency),
    postUpEfficiency: optionalFinite(input.postUpEfficiency), passingMetrics: input.passingMetrics || null,
    trackingMetrics: input.trackingMetrics || null, hustleMetrics: input.hustleMetrics || null,
    defensiveDistanceMetrics: input.defensiveDistanceMetrics || null, gameLogVariance: input.gameLogVariance || null,
    primaryPosition: String(input.primaryPosition || input.position || "SF").trim().toUpperCase(),
    eligiblePositions: Array.isArray(input.eligiblePositions) ? [...new Set(input.eligiblePositions.map((value) => String(value).toUpperCase()))] : [String(input.primaryPosition || input.position || "SF").trim().toUpperCase()],
    sourceCategoryCoverage: input.sourceCategoryCoverage || {},
    position: String(input.position || "SF").trim().toUpperCase(),
    team: input.team ? String(input.team).trim().toUpperCase() : null,
  };
  if (record.gamesStarted > record.gamesPlayed) throw new Error("Games started cannot exceed games played.");
  for (const key of ["fieldGoalPercentage", "threePointPercentage", "freeThrowPercentage"]) {
    if (record[key] !== null && (record[key] < 0 || record[key] > 1)) throw new Error(`${key} must be between 0 and 1.`);
  }
  for (const key of ["usageRate", "trueShootingPercentage", "effectiveFieldGoalPercentage", "assistPercentage", "turnoverPercentage", "offensiveReboundPercentage", "defensiveReboundPercentage", "rimFrequency", "rimEfficiency", "midRangeFrequency", "midRangeEfficiency", "threePointFrequency", "threePointEfficiency", "catchAndShootFrequency", "catchAndShootEfficiency", "pullUpFrequency", "pullUpEfficiency"]) {
    if (record[key] !== null && (record[key] < 0 || record[key] > 1)) throw new Error(`${key} must be between 0 and 1.`);
  }
  return Object.freeze(record);
}

// Provider adapters belong beside provider integrations. They must return this
// contract before the ratings generator is invoked; the generator never reads
// BALLDONTLIE or any other provider response shape directly.
export const isNormalizedSeasonStatRecord = (value) => {
  try { normalizeSeasonStatRecord(value); return true; } catch { return false; }
};
