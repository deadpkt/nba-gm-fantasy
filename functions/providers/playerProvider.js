export const PLAYER_PROVIDER_METHODS = Object.freeze([
  "fetchPlayers",
  "fetchSeasonStats",
  "fetchTeams",
  "normalizePlayer",
  "normalizeSeasonStats",
]);

export function assertPlayerProvider(provider) {
  if (!provider || typeof provider !== "object")
    throw new Error("A player-data provider is required.");
  const missing = PLAYER_PROVIDER_METHODS.filter(
    (method) => typeof provider[method] !== "function",
  );
  if (missing.length)
    throw new Error(`Player provider is missing: ${missing.join(", ")}.`);
  if (!provider.id || typeof provider.id !== "string")
    throw new Error("Player provider requires a stable id.");
  return provider;
}
