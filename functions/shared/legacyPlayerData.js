import { buildCanonicalPlayer, DEFAULT_PLAYER_COLOR, stripUndefinedValues } from "./nbaCatalog.js";

export function getObsoleteLegacyFields(player) {
  if (player?.source?.provider !== "balldontlie" || player?.source?.statsMode !== "directory-fallback") return [];
  const fields = [];
  if (player.stats?.available === true) fields.push("stats");
  if (player.ratings?.version !== "directory-baseline-v1" || player.ratings?.source !== "game-baseline") fields.push("ratings");
  if (player.gameData?.ratings?.version !== "directory-baseline-v1") fields.push("gameData.ratings");
  if (player.color && player.color !== DEFAULT_PLAYER_COLOR) fields.push("color");
  if (fields.includes("ratings") && Number.isFinite(player.overall)) fields.push("overall");
  return fields;
}

export function isLegacySeededCanonicalPlayer(player) {
  return getObsoleteLegacyFields(player).length > 0;
}

function providerPlayerFromCanonical(player) {
  return {
    id: player.source.externalId,
    first_name: player.firstName,
    last_name: player.lastName,
    position: player.sourcePosition,
    height: player.providerData?.height,
    weight: player.providerData?.weight,
    jersey_number: player.providerData?.jerseyNumber,
    college: player.providerData?.college,
    country: player.providerData?.country,
    draft_year: player.providerData?.draftYear,
    draft_round: player.providerData?.draftRound,
    draft_number: player.providerData?.draftNumber,
    team: player.providerData?.nbaTeam ? {
      id: player.providerData.nbaTeam.id,
      name: player.providerData.nbaTeam.name,
      full_name: player.providerData.nbaTeam.fullName,
      abbreviation: player.providerData.nbaTeam.abbreviation,
    } : null,
  };
}

export function cleanLegacySeededCanonicalPlayer(player, cleanedAt) {
  if (!isLegacySeededCanonicalPlayer(player)) return player;
  const rebuilt = buildCanonicalPlayer({
    providerPlayer: providerPlayerFromCanonical(player),
    existingPlayer: player,
    active: player.active,
    syncedAt: player.source?.syncedAt || cleanedAt,
    currentSeason: player.currentSeason || null,
    verificationStrategy: player.source?.verificationStrategy || null,
    headshotVersion: player.headshot?.version || null,
  });
  return stripUndefinedValues({
    ...rebuilt,
    active: player.active,
    draftEligible: player.draftEligible,
    catalogOrder: player.catalogOrder,
    currentSeason: player.currentSeason || null,
    lastVerifiedAt: player.lastVerifiedAt || cleanedAt,
    legacyDataCleanedAt: cleanedAt,
    legacyIdentityPreserved: String(player.id) !== `bdl_${player.source.externalId}`,
  });
}
