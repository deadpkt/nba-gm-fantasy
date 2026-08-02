import { PLAYER_SNAPSHOT_VERSION_V1, PLAYER_SNAPSHOT_VERSION_V2 } from "./engineVersions.js";
import { normalizeCanonicalPlayerRatings } from "./playerRatingsV2.js";

const compactSource = (source = {}) => source?.provider ? { provider: source.provider, externalId: source.externalId ?? null, dataVersion: source.dataVersion || null } : null;

export function buildLeaguePlayerSnapshot(player = {}, capturedAt = null) {
  if (player.id === undefined || player.id === null || !String(player.name || "").trim()) throw new Error("Canonical player identity is required.");
  const normalized = normalizeCanonicalPlayerRatings(player);
  const eligiblePositions = Array.isArray(player.eligiblePositions) && player.eligiblePositions.length ? [...new Set(player.eligiblePositions)] : [player.primaryPosition || player.position].filter(Boolean);
  return {
    id: player.id, playerId: player.id,
    name: player.name, firstName: player.firstName || null, lastName: player.lastName || null,
    position: player.primaryPosition || player.position, primaryPosition: player.primaryPosition || player.position,
    positions: eligiblePositions, eligiblePositions,
    team: player.team || player.providerData?.nbaTeam?.abbreviation || "FA",
    nbaTeam: player.providerData?.nbaTeam?.fullName || null,
    nbaTeamAbbreviation: player.providerData?.nbaTeam?.abbreviation || player.team || "FA",
    overall: normalized.overall, ratingsVersion: normalized.ratingsVersion, ratings: normalized.ratings,
    // Simulation V1 still derives its compact gameplay ratings from these
    // legacy per-game fields. Keep them until a future pinned V2 transition.
    stats: {
      points: Number.isFinite(player.stats?.points) ? player.stats.points : 0,
      rebounds: Number.isFinite(player.stats?.rebounds) ? player.stats.rebounds : 0,
      assists: Number.isFinite(player.stats?.assists) ? player.stats.assists : 0,
      ...(Number.isFinite(player.stats?.steals) ? { steals: player.stats.steals } : {}),
      ...(Number.isFinite(player.stats?.blocks) ? { blocks: player.stats.blocks } : {}),
    },
    imageUrl: player.imageUrl || player.image || "/player-placeholder.svg",
    image: player.imageUrl || player.image || "/player-placeholder.svg",
    nbaPlayerId: player.nbaPlayerId || player.headshot?.nbaPlayerId || null,
    headshot: player.headshot ? { ...player.headshot } : null,
    color: player.color || null, source: compactSource(player.source),
    snapshotVersion: PLAYER_SNAPSHOT_VERSION_V2, capturedAt,
  };
}

export function normalizeLeaguePlayerSnapshot(player = {}) {
  if (player.snapshotVersion === PLAYER_SNAPSHOT_VERSION_V2) return player;
  return { ...player, playerId: player.playerId ?? player.id, snapshotVersion: player.snapshotVersion || PLAYER_SNAPSHOT_VERSION_V1, ...normalizeCanonicalPlayerRatings(player) };
}
