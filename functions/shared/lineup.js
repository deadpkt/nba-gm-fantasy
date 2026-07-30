export const LINEUP_POSITIONS = Object.freeze(["PG", "SG", "SF", "PF", "C"]);

const LEGACY_POSITION_ELIGIBILITY = Object.freeze({
  G: ["PG", "SG"], F: ["SF", "PF"], C: ["C"],
  "G-F": ["SG", "SF"], "F-G": ["SG", "SF"],
  "F-C": ["PF", "C"], "C-F": ["PF", "C"],
});

const playerKey = (playerId) => playerId === null || playerId === undefined || playerId === "" ? null : String(playerId);

export function getPlayerEligiblePositions(player = {}) {
  const canonical = Array.isArray(player.eligiblePositions)
    ? player.eligiblePositions.filter((position) => LINEUP_POSITIONS.includes(position))
    : [];
  if (canonical.length) return [...new Set(canonical)];
  if (LINEUP_POSITIONS.includes(player.primaryPosition)) return [player.primaryPosition];
  const source = String(player.position || "").trim().toUpperCase();
  if (LINEUP_POSITIONS.includes(source)) return [source];
  if (LEGACY_POSITION_ELIGIBILITY[source]) return LEGACY_POSITION_ELIGIBILITY[source];
  return [...new Set(source.split(/[\s/,-]+/).filter((position) => LINEUP_POSITIONS.includes(position)))];
}

export function validateStartingLineup(team = {}, expectedRosterSize = 5) {
  const roster = Array.isArray(team.roster) ? team.roster : [];
  const rosterById = new Map(roster.map((player) => [playerKey(player.id), player]));
  const players = LINEUP_POSITIONS.map((position) => rosterById.get(playerKey(team.lineup?.[position])) || null);
  const ids = players.map((player) => playerKey(player?.id)).filter(Boolean);
  const legal = players.every((player, index) => player && getPlayerEligiblePositions(player).includes(LINEUP_POSITIONS[index]));
  return { valid: roster.length === expectedRosterSize && legal && ids.length === 5 && new Set(ids).size === 5, players };
}
