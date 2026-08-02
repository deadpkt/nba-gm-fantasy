const anomaly = (severity, code, result, message) => ({ severity, code, playerId: result.playerId, message });

export function detectRatingAnomalies(results = []) {
  const anomalies = [];
  const identities = new Set();
  const seasonRows = new Set();
  for (const result of results) {
    if (identities.has(result.playerId)) anomalies.push(anomaly("critical", "duplicate-player", result, "Duplicate canonical player result."));
    identities.add(result.playerId);
    const rowKey = `${result.externalPlayerId}:${result.ratingsSeason}`;
    if (seasonRows.has(rowKey)) anomalies.push(anomaly("critical", "duplicate-season-stats", result, "Duplicate provider season-stat identity."));
    seasonRows.add(rowKey);
    const ratings = result.ratings || {};
    const stats = result.normalizedInput || {};
    if (!result.playerId || !result.externalPlayerId) anomalies.push(anomaly("critical", "identity-mismatch", result, "Canonical or provider identity is missing."));
    if (!result.ratingsSeason || result.ratingsSeason !== stats.season) anomalies.push(anomaly("critical", "season-mismatch", result, "Result and input seasons differ."));
    if (!stats.primaryPosition || !["PG", "SG", "SF", "PF", "C"].includes(stats.primaryPosition)) anomalies.push(anomaly("critical", "missing-position", result, "Canonical primary position is unresolved."));
    if (result.overall >= 90 && result.ratingsConfidence?.level === "low") anomalies.push(anomaly("critical", "low-confidence-superstar", result, "Superstar overall was produced from low-confidence data."));
    if (Object.values(ratings).some((value) => typeof value === "number" && value === 99) && result.ratingsConfidence?.totalMinutes < 300) anomalies.push(anomaly("critical", "small-sample-99", result, "A maximum rating was produced from a small sample."));
    if ((stats.threePointAttemptsPerGame || 0) < 1 && ratings.threePoint >= 90) anomalies.push(anomaly("error", "non-shooter-elite-three", result, "Elite shooting conflicts with negligible volume."));
    if ((stats.offensiveReboundsPerGame || 0) + (stats.defensiveReboundsPerGame || 0) < 2 && Math.max(ratings.offensiveRebounding || 0, ratings.defensiveRebounding || 0) >= 90) anomalies.push(anomaly("error", "low-rebound-elite-rating", result, "Elite rebounding conflicts with observed production."));
    if (["PG", "SG"].includes(stats.primaryPosition) && ratings.interiorDefense >= 92 && !stats.defensiveDistanceMetrics?.rimOpponentEfficiency && (stats.blocksPerGame || 0) < 1) anomalies.push(anomaly("warning", "guard-interior-defense", result, "Elite guard interior defense lacks supporting advanced evidence."));
    if (stats.primaryPosition === "C" && ratings.ballHandling >= 92 && !stats.trackingMetrics?.touches && (stats.assistsPerGame || 0) < 5) anomalies.push(anomaly("warning", "center-ball-handling", result, "Elite center handling lacks creation evidence."));
    if (Object.entries(ratings).some(([key, value]) => key !== "version" && key !== "source" && (!Number.isInteger(value) || value < 25 || value > 99))) anomalies.push(anomaly("critical", "malformed-rating", result, "A rating is missing, non-integer, or out of bounds."));
  }
  return {
    anomalies,
    criticalCount: anomalies.filter((item) => item.severity === "critical").length,
    errorCount: anomalies.filter((item) => item.severity === "error").length,
    warningCount: anomalies.filter((item) => item.severity === "warning").length,
  };
}

