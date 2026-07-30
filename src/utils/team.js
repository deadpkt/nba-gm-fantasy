export const LINEUP_POSITIONS = ["PG", "SG", "SF", "PF", "C"];

const LEGACY_POSITION_ELIGIBILITY = Object.freeze({
  G: ["PG", "SG"], F: ["SF", "PF"], C: ["C"],
  "G-F": ["SG", "SF"], "F-G": ["SG", "SF"],
  "F-C": ["PF", "C"], "C-F": ["PF", "C"],
});

export const normalizePlayerId = (playerId) =>
  playerId === null || playerId === undefined || playerId === "" ? null : String(playerId);

export function getPlayerEligiblePositions(player = {}) {
  const canonical = Array.isArray(player.eligiblePositions)
    ? player.eligiblePositions.filter((position) => LINEUP_POSITIONS.includes(position))
    : [];
  if (canonical.length) return [...new Set(canonical)];
  if (LINEUP_POSITIONS.includes(player.primaryPosition)) return [player.primaryPosition];
  const source = String(player.position || "").trim().toUpperCase();
  if (LINEUP_POSITIONS.includes(source)) return [source];
  if (LEGACY_POSITION_ELIGIBILITY[source]) return LEGACY_POSITION_ELIGIBILITY[source];
  const parsed = source.split(/[\s/,-]+/).filter((position) => LINEUP_POSITIONS.includes(position));
  return [...new Set(parsed)];
}

export function isPlayerEligibleForPosition(player, position) {
  return LINEUP_POSITIONS.includes(position) && getPlayerEligiblePositions(player).includes(position);
}

export function findRosterPlayer(team, playerId) {
  const key = normalizePlayerId(playerId);
  return key === null ? null : team.find((player) => normalizePlayerId(player.id) === key) || null;
}

export function normalizeRosterLineup(team, lineup = {}) {
  const saved = lineup && typeof lineup === "object" && !Array.isArray(lineup) ? lineup : {};
  return Object.fromEntries(LINEUP_POSITIONS.map((position) => [
    position,
    findRosterPlayer(team, saved[position])?.id ?? null,
  ]));
}

export function buildLineupAssignment(team, lineup, position, playerId) {
  if (!LINEUP_POSITIONS.includes(position)) throw new Error("That lineup position is not valid.");
  const selectedPlayer = playerId === null || playerId === undefined || playerId === "" ? null : findRosterPlayer(team, playerId);
  if (playerId && !selectedPlayer) throw new Error("That player is not on this franchise roster.");
  if (selectedPlayer && !isPlayerEligibleForPosition(selectedPlayer, position)) throw new Error(`${selectedPlayer.name} is not eligible to play ${position}.`);
  const selectedId = selectedPlayer?.id ?? null;
  const next = Object.fromEntries(LINEUP_POSITIONS.map((slot) => {
    const assignedId = lineup?.[slot] ?? null;
    return [slot, selectedId !== null && normalizePlayerId(assignedId) === normalizePlayerId(selectedId) ? null : assignedId];
  }));
  next[position] = selectedId;
  return normalizeRosterLineup(team, next);
}

export function getAssignableLineupPlayers(team, lineup, position) {
  return team.filter((player) =>
    isPlayerEligibleForPosition(player, position) &&
    !Object.entries(lineup || {}).some(
      ([slot, playerId]) => slot !== position && normalizePlayerId(playerId) === normalizePlayerId(player.id),
    ));
}

export function getLineupValidation(team = [], lineup = {}) {
  const players = LINEUP_POSITIONS.map((position) => findRosterPlayer(team, lineup[position]));
  const ids = players.map((player) => normalizePlayerId(player?.id)).filter(Boolean);
  const missingPositions = LINEUP_POSITIONS.filter((position, index) => !players[index]);
  const ineligiblePositions = LINEUP_POSITIONS.filter(
    (position, index) => players[index] && !isPlayerEligibleForPosition(players[index], position),
  );
  return {
    valid: missingPositions.length === 0 && ineligiblePositions.length === 0 && ids.length === LINEUP_POSITIONS.length && new Set(ids).size === LINEUP_POSITIONS.length,
    missingPositions,
    ineligiblePositions,
    duplicatePlayers: ids.length !== new Set(ids).size,
    players,
  };
}

export function getLineupPlayers(team, lineup = {}) {
  return LINEUP_POSITIONS.map((position) =>
    findRosterPlayer(team, lineup[position]),
  ).filter(Boolean);
}

// Shared by league roster, lineup, and official-game flows.
export function getMissingLineupPositions(team, lineup = {}) {
  const validation = getLineupValidation(team, lineup);
  return [...new Set([...validation.missingPositions, ...validation.ineligiblePositions])];
}

export function isLineupComplete(team, lineup) {
  return getLineupValidation(team, lineup).valid;
}

export function getTeamOverall(players) {
  if (!players.length) return 0;
  return Math.round(
    players.reduce((total, player) => total + player.overall, 0) /
      players.length,
  );
}

export function getLineupOverall(team, lineup) {
  const players = getLineupPlayers(team, lineup);
  return isLineupComplete(team, lineup) ? getTeamOverall(players) : 0;
}

export function getChemistry(players) {
  if (!players.length) return 0;
  const positions = new Set(players.map((player) => player.position)).size;
  const teams = new Set(players.map((player) => player.team)).size;
  return Math.min(
    100,
    48 + positions * 9 + Math.min(teams, 4) * 4 + players.length * 3,
  );
}
