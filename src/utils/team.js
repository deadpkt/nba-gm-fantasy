export const LINEUP_POSITIONS = ["PG", "SG", "SF", "PF", "C"];

export function getLineupPlayers(team, lineup = {}) {
  return LINEUP_POSITIONS.map((position) =>
    team.find((player) => player.id === lineup[position]),
  ).filter(Boolean);
}

// Shared by league roster, lineup, and official-game flows.
export function getMissingLineupPositions(team, lineup = {}) {
  return LINEUP_POSITIONS.filter(
    (position) => !team.some((player) => player.id === lineup[position]),
  );
}

export function isLineupComplete(team, lineup) {
  return getMissingLineupPositions(team, lineup).length === 0;
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
