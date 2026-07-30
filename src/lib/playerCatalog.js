export const RUNTIME_PLAYER_CATALOG_SOURCE = "firestore-only";

export function isCanonicalCatalogPlayer(player) {
  return player?.active === true && player?.draftEligible === true && player?.source?.provider === "balldontlie" && Number.isInteger(player?.source?.externalId);
}

const identityKey = (player) => String(player?.source?.externalId ?? player?.externalId ?? "") ||
  String(player?.fullName || player?.name || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();

export function dedupeCatalogPlayers(players) {
  const seen = new Set();
  return players.filter((player) => {
    const key = identityKey(player);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function findCatalogPlayerById(players, playerId) {
  if (playerId === undefined || playerId === null) return null;
  return players.find((player) => String(player.id) === String(playerId)) || null;
}

export function resolvePlayerDetailsPlayer(players, requestedPlayer) {
  if (!requestedPlayer) return null;
  return findCatalogPlayerById(players, requestedPlayer.id) || requestedPlayer;
}
