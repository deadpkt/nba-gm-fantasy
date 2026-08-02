export const RATING_KEYS = ["overall", "rimScoring", "midRange", "threePoint", "freeThrow", "playmaking", "ballHandling", "turnoverControl", "perimeterDefense", "interiorDefense", "steal", "block", "offensiveRebounding", "defensiveRebounding", "athleticism", "stamina", "consistency"];
export const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
export function v2Players(prefix, base = 75, changes = {}) {
  return POSITIONS.map((position) => {
    const positionChanges = changes[position] || {};
    const ratings = Object.fromEntries(RATING_KEYS.map((key) => [key, positionChanges[key] ?? changes[key] ?? base]));
    ratings.overall = positionChanges.overall ?? changes.overall ?? base;
    return { id: `${prefix}-${position}`, playerId: `${prefix}-${position}`, name: `${prefix} ${position}`, position, primaryPosition: position, assignedPosition: position, eligiblePositions: [position], overall: ratings.overall, ratingsVersion: 2, snapshotVersion: 2, ratings: { version: 2, source: "verified-season-stats:test", season: 2026, ...ratings }, stats: { points: 15, rebounds: 5, assists: 4 } };
  });
}
export function v2Input(seed = "v2-seed", homePlayers = v2Players("H"), awayPlayers = v2Players("A"), strategies = {}) {
  return { seed, gameIdentity: { leagueId: "league-v2", gameId: `game-${seed}`, season: 2, scheduleVersion: 1, homeUid: "home", awayUid: "away" }, homeTeam: { name: "Home", strategy: strategies.home || "BALANCED" }, awayTeam: { name: "Away", strategy: strategies.away || "BALANCED" }, homePlayers, awayPlayers };
}
export function teamDocument(uid, players, strategy = "BALANCED") {
  return { ownerUid: uid, name: uid, roster: players, lineup: Object.fromEntries(players.map((player) => [player.assignedPosition, player.id])), strategy };
}
