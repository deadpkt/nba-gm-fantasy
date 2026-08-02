import { generateRatingsPreview } from "./generateRatingsPreview.js";
import { RATING_FORMULA_VERSION, RATING_FORMULA_VERSION_V2_4 } from "../shared/playerRatingsV2.js";
import { buildWarningResolutionV241 } from "../shared/playerRatingCalibrationV241.js";

const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100 : 0;
const median = (values) => values.length ? values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)] : 0;
const standardDeviation = (values) => { const mean = average(values); return Math.round(Math.sqrt(average(values.map((value) => (value - mean) ** 2))) * 100) / 100; };
const distribution = (values) => Object.fromEntries(Object.entries(values.reduce((result, value) => { const low = Math.floor(value / 5) * 5; const key = `${low}-${Math.min(99, low + 4)}`; result[key] = (result[key] || 0) + 1; return result; }, {})).toSorted(([left], [right]) => Number.parseInt(left, 10) - Number.parseInt(right, 10)));
const groupAverage = (rows, key, value) => average(rows.filter((row) => row[key] === value).map((row) => row.overall));

export function compareRatingsPreviews(beforePreview, afterPreview) {
  const before = new Map(beforePreview.players.map((player) => [String(player.playerId), player]));
  const after = afterPreview.players.map((player) => ({ ...player, previousOverall: before.get(String(player.playerId))?.overall ?? null, delta: player.overall - (before.get(String(player.playerId))?.overall ?? player.overall) }));
  const beforeValues = [...before.values()].map((player) => player.overall);
  const afterValues = after.map((player) => player.overall);
  const positions = [...new Set(after.map((player) => player.primaryPosition || player.normalizedInput?.primaryPosition).filter(Boolean))].toSorted();
  const confidenceLevels = [...new Set(after.map((player) => player.ratingsStatus).filter(Boolean))].toSorted();
  const ratingKeys = Object.keys(after[0]?.ratings || {}).filter((key) => Number.isInteger(after[0]?.ratings?.[key]) && key !== "version");
  return {
    before: { average: average(beforeValues), median: median(beforeValues), minimum: Math.min(...beforeValues), maximum: Math.max(...beforeValues), standardDeviation: standardDeviation(beforeValues), ratings80Plus: beforeValues.filter((value) => value >= 80).length, ratings85Plus: beforeValues.filter((value) => value >= 85).length, ratings90Plus: beforeValues.filter((value) => value >= 90).length, ratings95Plus: beforeValues.filter((value) => value >= 95).length, distribution: distribution(beforeValues) },
    after: { average: average(afterValues), median: median(afterValues), minimum: Math.min(...afterValues), maximum: Math.max(...afterValues), standardDeviation: standardDeviation(afterValues), ratings80Plus: afterValues.filter((value) => value >= 80).length, ratings85Plus: afterValues.filter((value) => value >= 85).length, ratings90Plus: afterValues.filter((value) => value >= 90).length, ratings95Plus: afterValues.filter((value) => value >= 95).length, distribution: distribution(afterValues), tierDistribution: after.reduce((result, player) => { const key = player.calibrationProfile?.tier || "UNCLASSIFIED"; result[key] = (result[key] || 0) + 1; return result; }, {}), roleDistribution: after.reduce((result, player) => { const key = player.calibrationProfile?.role || "UNCLASSIFIED"; result[key] = (result[key] || 0) + 1; return result; }, {}) },
    averageDelta: average(after.map((player) => player.delta)),
    averageAbsoluteDelta: average(after.map((player) => Math.abs(player.delta))),
    maximumAbsoluteDelta: Math.max(...after.map((player) => Math.abs(player.delta))),
    largestIncreases: after.toSorted((a, b) => b.delta - a.delta || String(a.playerId).localeCompare(String(b.playerId))).slice(0, 25).map(({ playerId, name, previousOverall, overall, delta }) => ({ playerId, name, previousOverall, overall, delta })),
    largestDecreases: after.toSorted((a, b) => a.delta - b.delta || String(a.playerId).localeCompare(String(b.playerId))).slice(0, 25).map(({ playerId, name, previousOverall, overall, delta }) => ({ playerId, name, previousOverall, overall, delta })),
    positionShifts: Object.fromEntries(positions.map((position) => [position, { before: groupAverage([...before.values()], "primaryPosition", position), after: groupAverage(after, "primaryPosition", position) }])),
    confidenceShifts: Object.fromEntries(confidenceLevels.map((status) => [status, { before: groupAverage([...before.values()], "ratingsStatus", status), after: groupAverage(after, "ratingsStatus", status) }])),
    attributeAverageChanges: Object.fromEntries(ratingKeys.map((key) => [key, { before: average([...before.values()].map((player) => player.ratings?.[key]).filter(Number.isFinite)), after: average(after.map((player) => player.ratings?.[key]).filter(Number.isFinite)) }])),
  };
}

const topBy = (players, key, count = 10) => players.filter((player) => Number.isInteger(player.ratings?.[key])).toSorted((a, b) => b.ratings[key] - a.ratings[key] || b.overall - a.overall || String(a.playerId).localeCompare(String(b.playerId))).slice(0, count).map((player) => ({ playerId: player.playerId, name: player.name, position: player.primaryPosition, overall: player.overall, rating: player.ratings[key] }));

export function buildEliteCalibrationDiagnostics(preview, comparison) {
  const sorted = preview.players.toSorted((a, b) => b.overall - a.overall || String(a.playerId).localeCompare(String(b.playerId)));
  const auditRow = (player, reasons = []) => ({ playerId: player.playerId, name: player.name, position: player.primaryPosition, team: player.normalizedInput?.team || null, overall: player.overall, populationRank: player.populationRank, positionRank: player.positionRank, role: player.calibrationProfile?.role, internalRole: player.calibrationProfile?.internalRole, tier: player.calibrationProfile?.tier, trend: player.calibrationProfile?.trend, shootingGravity: player.calibrationProfile?.shootingGravity, baseOverall: player.calibrationProfile?.baseOverall, currentFormIndicator: player.calibrationProfile?.currentFormIndicator, confidence: player.ratingsStatus, gamesPlayed: player.normalizedInput?.gamesPlayed, gamesStarted: player.normalizedInput?.gamesStarted, minutesPerGame: player.normalizedInput?.minutesPerGame, usageRate: player.normalizedInput?.usageRate, trueShootingPercentage: player.normalizedInput?.trueShootingPercentage, scoringLoad: player.calibrationProfile?.signals?.scoringLoad, responsibility: player.calibrationProfile?.signals?.responsibility, defensiveContribution: player.calibrationProfile?.signals?.defensiveImpact, reboundingContribution: player.calibrationProfile?.signals?.domains?.rebounding, domains: player.calibrationProfile?.signals?.domains, strengths: player.calibrationProfile?.explanation?.strengths || [], weaknesses: player.calibrationProfile?.explanation?.limiters || [], rawSkillOverall: player.calibrationProfile?.rawSkillOverall, roleImpactAdjustment: Math.round(((player.calibrationProfile?.responsibilityAdjustment || 0) + (player.calibrationProfile?.impactAdjustment || 0)) * 100) / 100, reliabilityAdjustment: player.calibrationProfile?.reliabilityAdjustment, finalBonusesAndPenalties: { efficiency: player.calibrationProfile?.efficiencyAdjustment, breadth: player.calibrationProfile?.breadthAdjustment, upperTail: player.calibrationProfile?.upperTailBoost, gravity: player.calibrationProfile?.gravityAdjustment, trend: player.calibrationProfile?.trendAdjustment, weakness: player.calibrationProfile?.weaknessPenalty, lowUsage: player.calibrationProfile?.lowUsageEfficiencyPenalty, inefficientVolume: player.calibrationProfile?.inefficientVolumePenalty, missingData: player.calibrationProfile?.missingDataPenalty }, reasons });
  const topOverall = preview.players.toSorted((a, b) => b.overall - a.overall || String(a.playerId).localeCompare(String(b.playerId))).slice(0, 25).map((player) => ({
    playerId: player.playerId, name: player.name, position: player.primaryPosition, gamesPlayed: player.normalizedInput?.gamesPlayed, minutesPerGame: player.normalizedInput?.minutesPerGame,
    confidence: player.ratingsConfidence, rawOverall: player.calibrationDiagnostics?.rawOverall, confidenceAdjustedOverall: player.calibrationDiagnostics?.confidenceAdjustedOverall, finalOverall: player.overall,
    eliteBoost: player.calibrationDiagnostics?.eliteBoost, twoWayBonus: player.calibrationDiagnostics?.twoWayBonus, weakLinkPenalty: player.calibrationDiagnostics?.weakLinkPenalty,
    strongestRatings: Object.entries(player.ratings || {}).filter(([, value]) => Number.isInteger(value)).toSorted((a, b) => b[1] - a[1]).slice(0, 6).map(([key, value]) => ({ key, value, signals: player.explanations?.[key]?.signals || [] })),
    role: player.calibrationProfile?.role, tier: player.calibrationProfile?.tier, populationRank: player.populationRank, positionRank: player.positionRank, explanation: player.calibrationProfile?.explanation,
    missingAttributes: player.calibrationDiagnostics?.missingAttributes || [], anomalies: player.anomalies || [], outliers: player.outliers || [],
  }));
  return {
    formulaVersion: RATING_FORMULA_VERSION, topOverall,
    leaders: { shooters: topBy(preview.players, "threePoint"), playmakers: topBy(preview.players, "playmaking"), perimeterDefenders: topBy(preview.players, "perimeterDefense"), interiorDefenders: topBy(preview.players, "interiorDefense"), rebounders: topBy(preview.players, "defensiveRebounding") },
    largestFormulaDeltas: comparison.largestIncreases,
    suspicious: preview.players.filter((player) => player.outliers?.length).map((player) => ({ playerId: player.playerId, name: player.name, overall: player.overall, status: player.ratingsStatus, role: player.calibrationProfile?.role, tier: player.calibrationProfile?.tier, reasons: player.outliers })),
    populationAudit: {
      allPlayers: sorted.map((player) => auditRow(player)), top100: sorted.slice(0, 100).map((player) => auditRow(player)), bottom100: sorted.slice(-100).map((player) => auditRow(player)),
      top20ByPosition: Object.fromEntries([...new Set(sorted.map((player) => player.primaryPosition).filter(Boolean))].toSorted().map((position) => [position, sorted.filter((player) => player.primaryPosition === position).slice(0, 20).map((player) => auditRow(player))])),
      topByRole: Object.fromEntries([...new Set(sorted.map((player) => player.calibrationProfile?.role).filter(Boolean))].toSorted().map((role) => [role, sorted.filter((player) => player.calibrationProfile?.role === role).slice(0, 25).map((player) => auditRow(player))])),
      ratings90Plus: sorted.filter((player) => player.overall >= 90).map((player) => auditRow(player, ["ELITE_OVR_REVIEW"])),
      ratings85To89: sorted.filter((player) => player.overall >= 85 && player.overall < 90).map((player) => auditRow(player, ["HIGH_LEVEL_OVR_REVIEW"])),
      lowConfidenceAbove82: sorted.filter((player) => player.overall > 82 && player.ratingsStatus !== "verified").map((player) => auditRow(player, ["LOW_CONFIDENCE_HIGH_OVR"])),
      workloadMismatch: sorted.filter((player) => player.overall >= 82 && (player.normalizedInput?.minutesPerGame || 0) < 24).map((player) => auditRow(player, ["OVR_WORKLOAD_MISMATCH"])),
      broadMissingData: sorted.filter((player) => (player.calibrationDiagnostics?.missingAttributes?.length || 0) >= 5).map((player) => auditRow(player, ["BROAD_ADVANCED_DATA_MISSING"])),
      largeFormulaDelta: sorted.filter((player) => Math.abs(player.overallDelta || 0) >= 5).map((player) => auditRow(player, ["LARGE_FORMULA_DELTA"])),
      sustainedElite: sorted.filter((player) => player.calibrationProfile?.trend === "SUSTAINED_ELITE").map((player) => auditRow(player)),
      breakouts: sorted.filter((player) => ["BREAKOUT", "IMPROVING"].includes(player.calibrationProfile?.trend)).map((player) => auditRow(player)),
      declining: sorted.filter((player) => ["DECLINING", "SHARP_DECLINE"].includes(player.calibrationProfile?.trend)).map((player) => auditRow(player)),
      smallSample: sorted.filter((player) => ["SMALL_SAMPLE", "RETURNING_FROM_LIMITED_SAMPLE"].includes(player.calibrationProfile?.trend)).map((player) => auditRow(player)),
      shootingGravityLeaders: sorted.toSorted((a, b) => (b.calibrationProfile?.shootingGravity || 0) - (a.calibrationProfile?.shootingGravity || 0)).slice(0, 50).map((player) => auditRow(player)),
    },
    realism: preview.manifest.calibrationRealism || null,
  };
}

export function recalibrateRatingsPreviewPayload(payload, { createdAt = new Date().toISOString(), formulaVersion = RATING_FORMULA_VERSION } = {}) {
  if (!Array.isArray(payload?.players) || !payload?.preview?.manifest || !Array.isArray(payload.preview.players)) throw new Error("Recalibration input must be a GOAT preview artifact with normalized players and an existing preview.");
  const eligibleEntries = payload.players.filter((entry) => entry?.player && entry?.seasonStats);
  const players = eligibleEntries.map((entry) => entry.player);
  const seasonStats = eligibleEntries.map((entry) => entry.seasonStats);
  if (!players.length) throw new Error("Recalibration input contains no players with validated normalized season stats.");
  const oldById = new Map(payload.preview.players.map((player) => [String(player.playerId), player]));
  const currentPlayers = players.map((player) => ({ ...player, overall: oldById.get(String(player.id))?.overall ?? player.overall }));
  const statsFrom = (season) => Array.isArray(season?.players) ? season.players.map((entry) => entry?.seasonStats).filter(Boolean) : Array.isArray(season?.seasonStats) ? season.seasonStats : [];
  const historicalSeasonStats = { previousSeason: statsFrom(payload.multiSeason?.previousSeason), twoSeasonsAgo: statsFrom(payload.multiSeason?.twoSeasonsAgo) };
  const v24Baseline = formulaVersion === RATING_FORMULA_VERSION ? generateRatingsPreview({ players, seasonStats, historicalSeasonStats, currentPlayers, season: payload.preview.manifest.season, createdAt, sourceCategoryCoverage: payload.preview.manifest.sourceCategoryCoverage || {}, formulaVersion: RATING_FORMULA_VERSION_V2_4 }) : null;
  const preview = generateRatingsPreview({ players, seasonStats, historicalSeasonStats, currentPlayers: v24Baseline?.players || currentPlayers, season: payload.preview.manifest.season, createdAt, sourceCategoryCoverage: payload.preview.manifest.sourceCategoryCoverage || {}, formulaVersion });
  preview.manifest.fetchManifest = payload.preview.manifest.fetchManifest || payload.manifest || null;
  preview.manifest.calibrationReview = { status: "required", reviewedAt: null, reviewedBy: null };
  preview.manifest.publication.blockers = [...new Set([...preview.manifest.publication.blockers, "admin-calibration-review-required"])];
  const comparison = compareRatingsPreviews(v24Baseline || payload.preview, preview);
  if (v24Baseline) {
    const resolution = buildWarningResolutionV241(v24Baseline.players, preview.players);
    preview.manifest.warningResolution = { sourceFormulaVersion: RATING_FORMULA_VERSION_V2_4, resolvedCount: resolution.filter((item) => item.status === "resolved").length, unresolvedCount: resolution.filter((item) => item.status === "unresolved").length, items: resolution };
  }
  const diagnostics = buildEliteCalibrationDiagnostics(preview, comparison);
  const outlierQueue = preview.players.flatMap((player) => player.outliers || []);
  const criticalOutlierCount = outlierQueue.filter((item) => item.severity === "CRITICAL").length;
  preview.manifest.calibrationOutliers = { total: outlierQueue.length, criticalCount: criticalOutlierCount, warningCount: outlierQueue.length - criticalOutlierCount, queue: outlierQueue };
  preview.manifest.anomalySummary = { ...(preview.manifest.anomalySummary || {}), criticalCount: preview.manifest.anomalySummary?.criticalCount || criticalOutlierCount };
  preview.manifest.calibrationComparison = comparison;
  preview.manifest.calibrationDiagnostics = {
    formulaVersion,
    topPlayerIds: diagnostics.populationAudit.top100.map((player) => player.playerId),
    reviewedPlayerCount: diagnostics.populationAudit.allPlayers.length,
    warningCount: preview.manifest.calibrationRealism?.warnings?.length || 0,
    criticalCount: preview.manifest.calibrationRealism?.criticalIssues?.length || 0,
  };
  return { ...payload, manifest: { ...(payload.manifest || {}), recalibratedAt: createdAt, formulaVersion, sourceImportId: payload.preview.manifest.importId, recalibratedPlayerCount: eligibleEntries.length, skippedWithoutValidatedStats: payload.players.length - eligibleEntries.length }, preview, comparison, diagnostics };
}
