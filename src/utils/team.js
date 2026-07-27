export function getTeamOverall(players) {
  if (!players.length) return 0
  return Math.round(players.reduce((total, player) => total + player.overall, 0) / players.length)
}

export function getChemistry(players) {
  if (!players.length) return 0
  const positions = new Set(players.map((player) => player.position)).size
  const teams = new Set(players.map((player) => player.team)).size
  return Math.min(100, 48 + positions * 9 + Math.min(teams, 4) * 4 + players.length * 3)
}
