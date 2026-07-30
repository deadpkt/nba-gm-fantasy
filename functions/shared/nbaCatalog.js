export const CATALOG_SYNC_VERSION = "balldontlie-v2-current-eligibility";
export const MIN_PLAUSIBLE_CURRENT_PLAYERS = 350;
export const MAX_PLAUSIBLE_CURRENT_PLAYERS = 700;
export const DIRECTORY_BASELINE_RATING = 75;
export const GAME_RATING_MIN = 60;
export const GAME_RATING_MAX = 99;
export const DEFAULT_PLAYER_COLOR = "#526981";

// Intentional game-balance tuning belongs here. Persisted catalog values are
// never treated as implicit overrides.
export const PLAYER_RATING_OVERRIDES = Object.freeze({});

function isPlainObject(value) {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

// Firestore rejects undefined at any depth. Canonical catalog values are plain
// data, so omit unavailable object fields and undefined array entries while
// leaving supported Firestore value objects untouched.
export function stripUndefinedValues(value) {
  if (Array.isArray(value)) return value.filter((item) => item !== undefined).map(stripUndefinedValues);
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .map(([key, item]) => [key, stripUndefinedValues(item)]));
}

export function findUndefinedPaths(value, path = "") {
  if (value === undefined) return [path || "<root>"];
  if (Array.isArray(value)) return value.flatMap((item, index) => findUndefinedPaths(item, `${path}[${index}]`));
  if (!isPlainObject(value)) return [];
  return Object.entries(value).flatMap(([key, item]) => findUndefinedPaths(item, path ? `${path}.${key}` : key));
}

export function normalizeNbaTeam(team) {
  if (!team || typeof team !== "object") return null;
  return stripUndefinedValues({
    id: team.id,
    name: team.name,
    fullName: team.full_name ?? team.fullName,
    abbreviation: team.abbreviation,
  });
}

export const POSITION_OVERRIDES = Object.freeze({
  "201939": { primaryPosition: "PG", eligiblePositions: ["PG", "SG"] },
  "203507": { primaryPosition: "PF", eligiblePositions: ["PF", "C"] },
  "203999": { primaryPosition: "C", eligiblePositions: ["C"] },
  "2544": { primaryPosition: "SF", eligiblePositions: ["SF", "PF"] },
});

const POSITION_MAP = Object.freeze({
  G: { primaryPosition: "PG", eligiblePositions: ["PG", "SG"] },
  F: { primaryPosition: "SF", eligiblePositions: ["SF", "PF"] },
  C: { primaryPosition: "C", eligiblePositions: ["C"] },
  "G-F": { primaryPosition: "SG", eligiblePositions: ["SG", "SF"] },
  "F-G": { primaryPosition: "SF", eligiblePositions: ["SG", "SF"] },
  "F-C": { primaryPosition: "PF", eligiblePositions: ["PF", "C"] },
  "C-F": { primaryPosition: "C", eligiblePositions: ["PF", "C"] },
  PG: { primaryPosition: "PG", eligiblePositions: ["PG", "SG"] },
  SG: { primaryPosition: "SG", eligiblePositions: ["PG", "SG"] },
  SF: { primaryPosition: "SF", eligiblePositions: ["SF", "PF"] },
  PF: { primaryPosition: "PF", eligiblePositions: ["SF", "PF"] },
});

export function normalizePlayerName(value = "") {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();
}

export function createHeadshotIdentityLookup(entries = []) {
  const lookup = new Map();
  entries.filter((entry) => entry?.name && /^\d+$/.test(String(entry.nbaPlayerId))).forEach((entry) => {
    const key = normalizePlayerName(entry.name);
    lookup.set(key, [...(lookup.get(key) || []), { nbaPlayerId: String(entry.nbaPlayerId), team: entry.team || null }]);
  });
  return lookup;
}

export function resolveHeadshotEnrichment(player, lookup) {
  const playerName = typeof player === "string" ? player : `${player?.first_name || ""} ${player?.last_name || ""}`;
  const identities = lookup.get(normalizePlayerName(playerName)) || [];
  const providerTeam = typeof player === "string" ? null : player?.team?.abbreviation;
  const identity = identities.find((candidate) => providerTeam && candidate.team === providerTeam) || (identities.length === 1 ? identities[0] : null);
  const nbaPlayerId = identity?.nbaPlayerId || null;
  return nbaPlayerId ? {
    nbaPlayerId,
    imageUrl: `https://cdn.nba.com/headshots/nba/latest/1040x760/${nbaPlayerId}.png`,
  } : null;
}

function providerIdentityScore(player, headshotIdentities) {
  const teamMatch = headshotIdentities.some((identity) => identity.team && identity.team === player.team?.abbreviation);
  return (teamMatch ? 1_000 : 0) + (player.draft_year ? 100 : 0) + (player.position ? 10 : 0) + (player.height ? 5 : 0) + (player.jersey_number ? 1 : 0);
}

export function selectCanonicalProviderIdentities(players, headshotLookup = new Map()) {
  const groups = new Map();
  players.forEach((player) => {
    const key = normalizePlayerName(`${player.first_name || ""} ${player.last_name || ""}`);
    groups.set(key, [...(groups.get(key) || []), player]);
  });
  return [...groups.entries()].map(([key, group]) => group.toSorted((first, second) =>
    providerIdentityScore(second, headshotLookup.get(key) || []) - providerIdentityScore(first, headshotLookup.get(key) || []) || first.id - second.id,
  )[0]);
}

export function normalizePosition(sourcePosition, playerId) {
  if (POSITION_OVERRIDES[String(playerId)]) return POSITION_OVERRIDES[String(playerId)];
  return POSITION_MAP[String(sourcePosition || "").toUpperCase()] || POSITION_MAP.F;
}

export function calculateGameRatings(stats, primaryPosition, existingRatings = null) {
  if (existingRatings?.overall && Number.isFinite(existingRatings.overall)) return existingRatings;
  if (!stats?.available) {
    return {
      overall: DIRECTORY_BASELINE_RATING, scoring: DIRECTORY_BASELINE_RATING,
      shooting: DIRECTORY_BASELINE_RATING, playmaking: DIRECTORY_BASELINE_RATING,
      rebounding: DIRECTORY_BASELINE_RATING, defense: DIRECTORY_BASELINE_RATING,
      stamina: DIRECTORY_BASELINE_RATING, clutch: DIRECTORY_BASELINE_RATING,
      version: "directory-baseline-v1", source: "game-baseline",
    };
  }
  const clamp = (value) => Math.max(GAME_RATING_MIN, Math.min(GAME_RATING_MAX, Math.round(value)));
  const scoring = clamp(60 + (stats.points || 0) * 1.1);
  const shooting = clamp(60 + (stats.fgPct || 0) * 35 + (stats.threePct || 0) * 30);
  const playmaking = clamp(60 + (stats.assists || 0) * 3);
  const rebounding = clamp(60 + (stats.rebounds || 0) * 2.2);
  const defense = clamp(60 + (stats.steals || 0) * 8 + (stats.blocks || 0) * 6);
  const stamina = clamp(60 + Math.min(35, (stats.minutes || 0)));
  const weights = [scoring, shooting, playmaking, rebounding, defense, stamina];
  return { overall: clamp(weights.reduce((sum, value) => sum + value, 0) / weights.length), scoring, shooting, playmaking, rebounding, defense, stamina, clutch: clamp((scoring + playmaking) / 2), version: "provider-stats-v1", source: "game-derived" };
}

function compatibilityStats(providerStats) {
  if (!providerStats?.available) return { available: false, points: 0, rebounds: 0, assists: 0 };
  return {
    available: true, season: providerStats.season ?? null,
    points: providerStats.points || 0, rebounds: providerStats.rebounds || 0,
    assists: providerStats.assists || 0, steals: providerStats.steals || 0,
    blocks: providerStats.blocks || 0, fieldGoalPercentage: providerStats.fgPct || 0,
    threePointPercentage: providerStats.threePct || 0, freeThrowPercentage: providerStats.ftPct || 0,
    gamesPlayed: providerStats.gamesPlayed || 0, minutes: providerStats.minutes || 0,
  };
}

export function buildCanonicalPlayer({ providerPlayer, existingPlayer = null, active, syncedAt, providerStats = null, currentSeason = null, verificationStrategy = null, headshotEnrichment = null, headshotVersion = null }) {
  if (!Number.isInteger(providerPlayer?.id)) throw new Error("BALLDONTLIE player ID must be an integer.");
  const fullName = `${providerPlayer.first_name || ""} ${providerPlayer.last_name || ""}`.trim();
  if (!fullName) throw new Error("Provider player name is required.");
  const id = existingPlayer?.id ?? `bdl_${providerPlayer.id}`;
  const position = normalizePosition(providerPlayer.position, id);
  const stats = providerStats?.available ? compatibilityStats(providerStats) : compatibilityStats(null);
  const ratingOverride = PLAYER_RATING_OVERRIDES[String(id)] || PLAYER_RATING_OVERRIDES[`bdl_${providerPlayer.id}`] || null;
  const ratings = calculateGameRatings(providerStats, position.primaryPosition, ratingOverride);
  const existingNbaPlayerId = existingPlayer?.nbaPlayerId || existingPlayer?.headshot?.nbaPlayerId || null;
  const nbaPlayerId = headshotEnrichment?.nbaPlayerId || existingNbaPlayerId;
  const existingImageUrl = existingPlayer?.imageUrl || existingPlayer?.image;
  const imageUrl = headshotEnrichment?.imageUrl || existingImageUrl || "/player-placeholder.svg";
  return stripUndefinedValues({
    id,
    externalId: providerPlayer.id,
    name: fullName,
    firstName: providerPlayer.first_name || "",
    lastName: providerPlayer.last_name || "",
    fullName,
    position: position.primaryPosition,
    primaryPosition: position.primaryPosition,
    eligiblePositions: position.eligiblePositions,
    sourcePosition: providerPlayer.position || "",
    // Team affiliation is provider-owned. A historical manual team must not
    // become the fallback when the provider reports no current team.
    team: providerPlayer.team?.abbreviation || "FA",
    overall: ratings.overall,
    stats,
    ratings,
    nbaPlayerId,
    imageUrl,
    image: imageUrl,
    headshot: nbaPlayerId ? { nbaPlayerId, source: "nba-com-identity-snapshot", version: headshotVersion || existingPlayer?.headshot?.version || null } : null,
    color: DEFAULT_PLAYER_COLOR,
    active: Boolean(active),
    draftEligible: Boolean(active),
    currentSeason,
    lastVerifiedAt: syncedAt,
    providerData: {
      height: providerPlayer.height || null, weight: providerPlayer.weight || null,
      jerseyNumber: providerPlayer.jersey_number || null, college: providerPlayer.college || null,
      country: providerPlayer.country || null, draftYear: providerPlayer.draft_year || null,
      draftRound: providerPlayer.draft_round || null, draftNumber: providerPlayer.draft_number || null,
      nbaTeam: normalizeNbaTeam(providerPlayer.team),
      stats: providerStats?.available ? stripUndefinedValues(providerStats) : null,
    },
    gameData: { ratings, positionOverride: POSITION_OVERRIDES[String(id)] || null },
    source: { provider: "balldontlie", externalId: providerPlayer.id, syncedAt, dataVersion: CATALOG_SYNC_VERSION, statsMode: providerStats?.available ? "enriched" : "directory-fallback", verificationStrategy },
  });
}

export function selectCurrentPlayerCandidates(providerPlayers, snapshotNames) {
  const allowedNames = new Set(snapshotNames.map(normalizePlayerName));
  return providerPlayers.filter((player) => allowedNames.has(normalizePlayerName(`${player.first_name || ""} ${player.last_name || ""}`)));
}

export function assertPlausibleCurrentPlayerCount(count, { min = MIN_PLAUSIBLE_CURRENT_PLAYERS, max = MAX_PLAUSIBLE_CURRENT_PLAYERS } = {}) {
  if (!Number.isInteger(count) || count < min || count > max) {
    throw new Error(`Refusing to publish implausible current-player catalog size ${count}; expected ${min}-${max}.`);
  }
}

export function mergeProviderCatalog({ providerPlayers, existingPlayers = [], activeIds = null, syncedAt, currentSeason = null, verificationStrategy = null, headshotLookup = new Map(), headshotVersion = null }) {
  const byExternalId = new Map(existingPlayers.filter((player) => Number.isInteger(player?.source?.externalId ?? player?.externalId)).map((player) => [player.source?.externalId ?? player.externalId, player]));
  const byName = new Map(existingPlayers.map((player) => [normalizePlayerName(player.fullName || player.name), player]));
  const seenProvider = new Set();
  const players = [];
  providerPlayers.forEach((providerPlayer) => {
    if (seenProvider.has(providerPlayer.id)) return;
    seenProvider.add(providerPlayer.id);
    const name = normalizePlayerName(`${providerPlayer.first_name || ""} ${providerPlayer.last_name || ""}`);
    const existingPlayer = byExternalId.get(providerPlayer.id) || byName.get(name) || null;
    const headshotEnrichment = resolveHeadshotEnrichment(providerPlayer, headshotLookup);
    players.push(buildCanonicalPlayer({ providerPlayer, existingPlayer, active: activeIds ? activeIds.has(providerPlayer.id) : true, syncedAt, currentSeason, verificationStrategy, headshotEnrichment, headshotVersion }));
  });
  const syncedIds = new Set(players.map((player) => String(player.id)));
  const inactive = existingPlayers.filter((player) => !syncedIds.has(String(player.id))).map((player) => ({ ...player, active: false, draftEligible: false }));
  return { players, inactive };
}

export function getAvailableLeaguePlayers(players, ownedPlayerIds) {
  const owned = new Set([...ownedPlayerIds].map(String));
  return players.filter((player) => isCanonicalDraftCandidate(player) && !owned.has(String(player.id)));
}

export function isCanonicalDraftCandidate(player) {
  return player?.active === true && player?.draftEligible === true && player?.source?.provider === "balldontlie" && Number.isInteger(player?.source?.externalId);
}

export function paginateCatalog(players, { search = "", position = "ALL", offset = 0, limit = 48 } = {}) {
  const query = normalizePlayerName(search);
  const filtered = players.filter((player) => (position === "ALL" || (player.eligiblePositions || [player.position]).includes(position)) && (!query || normalizePlayerName(`${player.name} ${player.team}`).includes(query))).toSorted((a, b) => b.overall - a.overall || a.name.localeCompare(b.name));
  return { items: filtered.slice(offset, offset + limit), total: filtered.length, nextOffset: offset + limit < filtered.length ? offset + limit : null };
}
