import { hasVerifiedRatingsV2, isValidRatingsV2 } from "./playerRatingsV2.js";

export const RATINGS_PUBLICATION_THRESHOLDS = Object.freeze({
  activeIdentityCoverage: .98,
  verifiedCoreStatCoverage: .95,
  duplicateIdentityCount: 0,
  duplicateProviderIdCount: 0,
  malformedRatingCount: 0,
  criticalAnomalyCount: 0,
  missingPositionCount: 0,
});

export function buildGeneratedRatingsCoverage(results = [], { expectedActivePlayers = results.length, anomalies = { criticalCount: 0, anomalies: [] } } = {}) {
  const ratings = results.map((result) => result.overall).filter(Number.isFinite).toSorted((a, b) => a - b);
  const distribution = {};
  const attributeDistribution = {};
  const positionDistribution = {};
  for (const result of results) {
    const band = `${Math.floor(result.overall / 5) * 5}-${Math.min(99, Math.floor(result.overall / 5) * 5 + 4)}`;
    distribution[band] = (distribution[band] || 0) + 1;
    const position = result.normalizedInput?.primaryPosition || "UNKNOWN";
    positionDistribution[position] = (positionDistribution[position] || 0) + 1;
    for (const [key, value] of Object.entries(result.ratings || {})) {
      if (key === "version" || !Number.isInteger(value)) continue;
      attributeDistribution[key] ||= { min: value, max: value, total: 0, count: 0 };
      const row = attributeDistribution[key]; row.min = Math.min(row.min, value); row.max = Math.max(row.max, value); row.total += value; row.count += 1;
    }
  }
  for (const row of Object.values(attributeDistribution)) { row.average = Math.round(row.total / row.count * 10) / 10; delete row.total; delete row.count; }
  const coreCoverage = results.length ? results.reduce((sum, result) => sum + (result.ratingsConfidence?.coreCoverage || 0), 0) / results.length : 0;
  const missingPositions = results.filter((result) => !["PG", "SG", "SF", "PF", "C"].includes(result.normalizedInput?.primaryPosition)).length;
  const duplicateIdentities = new Set(results.map((result) => result.playerId)).size !== results.length ? results.length - new Set(results.map((result) => result.playerId)).size : 0;
  const providerIds = results.map((result) => String(result.externalPlayerId || "")).filter(Boolean);
  const duplicateProviderIds = providerIds.length - new Set(providerIds).size;
  const malformed = results.filter((result) => !isValidRatingsV2(result.ratings)).length;
  const coverage = {
    playerCount: results.length, activeIdentityCoverage: expectedActivePlayers ? results.length / expectedActivePlayers : 0,
    verifiedCoreStatCoverage: coreCoverage, verifiedCount: results.filter((result) => result.ratingsStatus === "verified").length,
    provisionalCount: results.filter((result) => result.ratingsStatus === "provisional").length,
    insufficientDataCount: results.filter((result) => result.ratingsStatus === "insufficient_data").length,
    missingPositionCount: missingPositions, duplicateIdentityCount: duplicateIdentities, duplicateProviderIdCount: duplicateProviderIds, malformedRatingCount: malformed,
    criticalAnomalyCount: anomalies.criticalCount || 0, overallAverage: ratings.length ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 10) / 10 : null,
    overallMedian: ratings.length ? ratings[Math.floor(ratings.length / 2)] : null, ratings90Plus: ratings.filter((value) => value >= 90).length,
    ratings95Plus: ratings.filter((value) => value >= 95).length, ratings99: ratings.filter((value) => value === 99).length,
    ratingDistribution: distribution, attributeDistribution, positionDistribution,
  };
  coverage.publicationEligible = coverage.activeIdentityCoverage >= RATINGS_PUBLICATION_THRESHOLDS.activeIdentityCoverage && coverage.verifiedCoreStatCoverage >= RATINGS_PUBLICATION_THRESHOLDS.verifiedCoreStatCoverage &&
    coverage.duplicateIdentityCount === 0 && coverage.duplicateProviderIdCount === 0 && coverage.malformedRatingCount === 0 && coverage.criticalAnomalyCount === 0 && coverage.missingPositionCount === 0;
  return coverage;
}

export function buildRatingsCoverageReport(players = [], snapshots = []) {
  const eligible = players.filter((player) => player.active === true && player.draftEligible === true);
  const distribution = {};
  const positions = {};
  let malformedRatings = 0;
  eligible.forEach((player) => {
    distribution[player.overall] = (distribution[player.overall] || 0) + 1;
    const position = player.primaryPosition || player.position || "UNKNOWN";
    positions[position] = (positions[position] || 0) + 1;
    if (player.ratingsVersion === 2 && !isValidRatingsV2(player.ratings)) malformedRatings += 1;
  });
  const required = ["id", "playerId", "name", "eligiblePositions", "overall", "ratingsVersion", "ratings", "snapshotVersion"];
  const rows = snapshots.map((snapshot) => ({ origin: snapshot.origin || "unknown", snapshotVersion: snapshot.snapshotVersion || 1, missingFields: required.filter((key) => snapshot[key] === undefined || snapshot[key] === null) }));
  return {
    totalCanonicalPlayers: players.length, activeDraftEligibleCount: eligible.length,
    v1BaselineCount: eligible.filter((player) => !hasVerifiedRatingsV2(player)).length,
    verifiedV2Count: eligible.filter(hasVerifiedRatingsV2).length, malformedRatingsCount: malformedRatings,
    overallDistribution: distribution, positionDistribution: positions, snapshotCount: rows.length,
    normalizedSnapshotCount: rows.filter((row) => row.snapshotVersion === 2 && row.missingFields.length === 0).length,
    missingSnapshotFields: rows,
  };
}

export function snapshotsShareGameplayShape(first, second) {
  const keys = ["id", "playerId", "name", "position", "primaryPosition", "positions", "eligiblePositions", "overall", "ratingsVersion", "ratings", "snapshotVersion"];
  return keys.every((key) => Object.hasOwn(first || {}, key) && Object.hasOwn(second || {}, key));
}
