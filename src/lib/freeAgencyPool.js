export function filterUnownedPlayers(players = [], ownedPlayerIds = new Set()) {
  return players.filter((player) => player?.active === true && player?.draftEligible === true && !ownedPlayerIds.has(String(player.id)));
}
