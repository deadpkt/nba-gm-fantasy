export function buildPlayerDataCoverage(players = [], validation = { counts: {} }) {
  const positionDistribution = {};
  const ratingDistribution = {};
  players.forEach((player) => {
    positionDistribution[player.position || "UNKNOWN"] = (positionDistribution[player.position || "UNKNOWN"] || 0) + 1;
    const overall = player.ratings?.overall;
    if (Number.isFinite(overall)) {
      const band = `${Math.floor(overall / 5) * 5}-${Math.floor(overall / 5) * 5 + 4}`;
      ratingDistribution[band] = (ratingDistribution[band] || 0) + 1;
    }
  });
  return {
    totalPlayers: players.length,
    activePlayers: players.filter((player) => player.status?.active).length,
    inactivePlayers: players.filter((player) => !player.status?.active).length,
    playersWithVerifiedRatings: players.filter((player) => player.ratings?.verified === true).length,
    playersMissingRatings: players.filter((player) => !player.ratings).length,
    missingImages: validation.counts?.["missing-image"] || 0,
    duplicateNames: validation.counts?.["duplicate-name"] || 0,
    duplicateIds: validation.counts?.["duplicate-id"] || 0,
    positionDistribution,
    ratingDistribution,
  };
}

