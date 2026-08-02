import { normalizePlayerName } from "./nbaCatalog.js";

export const PLAYER_IDENTITY_MATCH_VERSION = "canonical-identity-v1";

export function buildPlayerIdentityIndex(currentPlayers = []) {
  const external = new Map(); const nba = new Map(); const names = new Map();
  for (const player of currentPlayers) {
    const id = String(player.id ?? player.identity?.id);
    const identities = player.identity?.externalIds || [];
    identities.forEach((identity) => external.set(`${identity.namespace}:${identity.value}`, id));
    if (player.source?.provider && player.source?.externalId !== undefined) external.set(`${player.source.provider}:${player.source.externalId}`, id);
    if (player.nbaPlayerId) nba.set(String(player.nbaPlayerId), id);
    const key = normalizePlayerName(player.fullName || player.name?.full || player.name || "");
    if (key) names.set(key, [...(names.get(key) || []), id]);
  }
  return { external, nba, names };
}

export function matchCanonicalPlayerIdentity(candidate, index) {
  for (const identity of candidate.identity?.externalIds || []) {
    const match = index.external.get(`${identity.namespace}:${identity.value}`);
    if (match) return { canonicalId: match, method: "provider-external-identity", reviewRequired: false };
  }
  const nbaId = candidate.headshot?.externalId || candidate.nbaPlayerId;
  if (nbaId && index.nba.has(String(nbaId))) return { canonicalId: index.nba.get(String(nbaId)), method: "nba-identity", reviewRequired: false };
  const name = normalizePlayerName(candidate.name?.full || candidate.name || "");
  const matches = index.names.get(name) || [];
  if (matches.length === 1) return { canonicalId: matches[0], method: "normalized-identity", reviewRequired: true };
  return { canonicalId: candidate.identity?.id || null, method: matches.length > 1 ? "ambiguous" : "unmatched", reviewRequired: true };
}

